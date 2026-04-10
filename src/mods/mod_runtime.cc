// Copyright 2024 The Fennec Authors. All rights reserved.
// Use of this source code is governed by a GPL-3.0 license.

#include "fennec/mods/mod_runtime.h"

#include <utility>

#include "base/files/file_enumerator.h"
#include "base/files/file_util.h"
#include "base/json/json_reader.h"
#include "base/logging.h"
#include "base/strings/string_number_conversions.h"
#include "base/strings/string_util.h"
#include "base/values.h"
#include "fennec/journal/request_journal.h"
#include "third_party/zlib/google/zip.h"

namespace fennec {

namespace {

constexpr char kManifestFileName[] = "manifest.json";

std::optional<std::string> ReadTextFile(const base::FilePath& path) {
  std::string contents;
  if (!base::ReadFileToString(path, &contents))
    return std::nullopt;
  return contents;
}

bool DictString(const base::Value::Dict& dict,
                const char* key,
                std::string* out_value) {
  const std::string* value = dict.FindString(key);
  if (!value || value->empty())
    return false;
  *out_value = *value;
  return true;
}

std::optional<ModSurface> ModSurfaceFromString(const std::string& value) {
  if (value == "sidebar")
    return ModSurface::kSidebar;
  if (value == "newtab")
    return ModSurface::kNewTab;
  if (value == "settings")
    return ModSurface::kSettings;
  if (value == "journal")
    return ModSurface::kJournal;
  if (value == "layout")
    return ModSurface::kLayout;
  return std::nullopt;
}

bool HasSurface(const InstalledMod& mod, ModSurface surface) {
  return std::find(mod.manifest.surfaces.begin(), mod.manifest.surfaces.end(),
                   surface) != mod.manifest.surfaces.end();
}

}  // namespace

std::string ModSurfaceToString(ModSurface surface) {
  switch (surface) {
    case ModSurface::kSidebar:
      return "sidebar";
    case ModSurface::kNewTab:
      return "newtab";
    case ModSurface::kSettings:
      return "settings";
    case ModSurface::kJournal:
      return "journal";
    case ModSurface::kLayout:
      return "layout";
  }
  return "unknown";
}

ModRuntime::ModRuntime(const base::FilePath& profile_path,
                       RequestJournal* journal)
    : profile_path_(profile_path),
      mods_root_(profile_path.AppendASCII("fennec-mods")),
      journal_(journal) {}

ModRuntime::~ModRuntime() = default;

bool ModRuntime::Initialize() {
  return EnsureModsDirectory() && LoadInstalledModsFromDisk();
}

bool ModRuntime::EnsureModsDirectory() {
  if (base::DirectoryExists(mods_root_))
    return true;
  if (!base::CreateDirectory(mods_root_)) {
    LOG(ERROR) << "[ModRuntime] Could not create mods dir: " << mods_root_;
    return false;
  }
  return true;
}

bool ModRuntime::LoadInstalledModsFromDisk() {
  installed_mods_.clear();

  base::FileEnumerator enumerator(mods_root_, false,
                                  base::FileEnumerator::DIRECTORIES);
  for (base::FilePath path = enumerator.Next(); !path.empty();
       path = enumerator.Next()) {
    InstalledMod mod;
    if (LoadInstalledModAtPath(path, &mod)) {
      installed_mods_.push_back(std::move(mod));
    }
  }

  return true;
}

bool ModRuntime::LoadInstalledModAtPath(const base::FilePath& mod_path,
                                        InstalledMod* out_mod) {
  base::Value::Dict manifest_dict;
  if (!ReadManifest(mod_path.AppendASCII(kManifestFileName), &manifest_dict))
    return false;

  InstalledMod mod;
  mod.root_path = mod_path;

  if (!ValidateManifest(manifest_dict, mod_path, &mod.manifest)) {
    LOG(WARNING) << "[ModRuntime] Rejecting invalid mod at " << mod_path;
    return false;
  }

  if (!LoadTextAssetIfPresent(mod_path, mod.manifest.css, &mod.text_assets))
    return false;
  if (!LoadTextAssetIfPresent(mod_path, mod.manifest.js, &mod.text_assets))
    return false;
  if (!LoadPanelAssetIfPresent(mod_path, mod.manifest.panel, &mod.text_assets))
    return false;

  *out_mod = std::move(mod);
  return true;
}

bool ModRuntime::InstallArchive(const base::FilePath& archive_path) {
  std::string bytes;
  if (!base::ReadFileToString(archive_path, &bytes)) {
    LOG(ERROR) << "[ModRuntime] Could not read archive: " << archive_path;
    return false;
  }
  return InstallArchiveBytes(bytes);
}

bool ModRuntime::InstallArchiveBytes(const std::string& archive_bytes) {
  // Chromium integration note:
  // The production browser patch is expected to call into the zip reader from
  // //third_party/zlib/google/zip_reader.h here and expand into a temporary
  // directory first. This repo snapshot does not ship the browser-side unzip
  // plumbing, so we keep the extraction method isolated behind this helper.

  base::FilePath temp_dir;
  if (!base::CreateTemporaryDirInDir(mods_root_, FILE_PATH_LITERAL("mod_tmp"),
                                     &temp_dir)) {
    LOG(ERROR) << "[ModRuntime] Could not create temp dir for archive";
    return false;
  }

  if (!ExtractArchiveToDirectory(archive_bytes, temp_dir)) {
    base::DeletePathRecursively(temp_dir);
    return false;
  }

  base::Value::Dict manifest_dict;
  if (!ReadManifest(temp_dir.AppendASCII(kManifestFileName), &manifest_dict)) {
    base::DeletePathRecursively(temp_dir);
    return false;
  }

  ModManifest manifest;
  if (!ValidateManifest(manifest_dict, temp_dir, &manifest)) {
    base::DeletePathRecursively(temp_dir);
    return false;
  }

  const base::FilePath final_dir = mods_root_.AppendASCII(manifest.id);
  base::DeletePathRecursively(final_dir);
  if (!base::Move(temp_dir, final_dir)) {
    LOG(ERROR) << "[ModRuntime] Could not finalize install dir: " << final_dir;
    base::DeletePathRecursively(temp_dir);
    return false;
  }

  return LoadInstalledModsFromDisk();
}

bool ModRuntime::SetEnabled(const std::string& mod_id, bool enabled) {
  for (InstalledMod& mod : installed_mods_) {
    if (mod.manifest.id == mod_id) {
      mod.enabled = enabled;
      return true;
    }
  }
  return false;
}

bool ModRuntime::Uninstall(const std::string& mod_id) {
  const base::FilePath path = mods_root_.AppendASCII(mod_id);
  if (!base::DeletePathRecursively(path)) {
    LOG(ERROR) << "[ModRuntime] Could not delete mod dir: " << path;
    return false;
  }
  return LoadInstalledModsFromDisk();
}

std::vector<InstalledMod> ModRuntime::GetInstalledModsForSurface(
    ModSurface surface) const {
  std::vector<InstalledMod> result;
  for (const InstalledMod& mod : installed_mods_) {
    if (mod.enabled && HasSurface(mod, surface))
      result.push_back(mod);
  }
  return result;
}

std::string ModRuntime::BuildInjectedCssForSurface(ModSurface surface) const {
  std::string css;

  for (const InstalledMod& mod : installed_mods_) {
    if (!mod.enabled || !HasSurface(mod, surface))
      continue;

    if (!mod.manifest.tokens.empty()) {
      css.append(":root {");
      for (const auto& [key, value] : mod.manifest.tokens) {
        css.append(key);
        css.push_back(':');
        css.append(value);
        css.push_back(';');
      }
      css.append("}\n");
    }

    if (mod.manifest.css) {
      auto asset_it = mod.text_assets.find(*mod.manifest.css);
      if (asset_it != mod.text_assets.end()) {
        css.append("/* mod:");
        css.append(mod.manifest.id);
        css.append(" */\n");
        css.append(asset_it->second);
        css.push_back('\n');
      }
    }
  }

  return css;
}

std::vector<base::Value::Dict> ModRuntime::BuildInjectedScriptsForSurface(
    ModSurface surface) const {
  std::vector<base::Value::Dict> scripts;

  for (const InstalledMod& mod : installed_mods_) {
    if (!mod.enabled || !HasSurface(mod, surface) || !mod.manifest.js)
      continue;

    auto asset_it = mod.text_assets.find(*mod.manifest.js);
    if (asset_it == mod.text_assets.end())
      continue;

    base::Value::Dict script;
    script.Set("id", mod.manifest.id);
    script.Set("surface", ModSurfaceToString(surface));
    script.Set("source", asset_it->second);
    script.Set("panel_title", mod.manifest.panel ? mod.manifest.panel->title : "");
    scripts.push_back(std::move(script));
  }

  return scripts;
}

base::Value::List ModRuntime::SerializeInstalledMods() const {
  base::Value::List list;

  for (const InstalledMod& mod : installed_mods_) {
    base::Value::Dict item;
    item.Set("id", mod.manifest.id);
    item.Set("name", mod.manifest.name);
    item.Set("version", mod.manifest.version);
    item.Set("author", mod.manifest.author);
    item.Set("description", mod.manifest.description);
    item.Set("license", mod.manifest.license);
    item.Set("enabled", mod.enabled);

    base::Value::List surfaces;
    for (ModSurface surface : mod.manifest.surfaces)
      surfaces.Append(ModSurfaceToString(surface));
    item.Set("surfaces", std::move(surfaces));

    list.Append(std::move(item));
  }

  return list;
}

void ModRuntime::RecordViolation(const std::string& mod_id,
                                 const std::string& attempted_api) {
  if (!journal_)
    return;

  const int64_t entry_id = journal_->RecordRequest(
      "fennec://mods/" + mod_id,
      "mod-violation",
      "fennec://settings",
      "fennec://settings",
      "fennec-internal",
      ResourceClass::kFennecInternal);

  journal_->RecordBlock(entry_id, "mod-violation: " + attempted_api);
}

bool ModRuntime::ExtractArchiveToDirectory(const std::string& archive_bytes,
                                           const base::FilePath& destination) {
  const base::FilePath archive_path = destination.AppendASCII("install.fennecmod");
  if (base::WriteFile(archive_path, archive_bytes) < 0) {
    LOG(ERROR) << "[ModRuntime] Could not stage archive for extraction: "
               << archive_path;
    return false;
  }

  if (!zip::Unzip(archive_path, destination)) {
    LOG(ERROR) << "[ModRuntime] Could not extract archive into " << destination;
    base::DeleteFile(archive_path);
    return false;
  }

  base::DeleteFile(archive_path);
  return true;
}

bool ModRuntime::ReadManifest(const base::FilePath& path,
                              base::Value::Dict* out_dict) const {
  std::optional<std::string> manifest_json = ReadTextFile(path);
  if (!manifest_json) {
    LOG(ERROR) << "[ModRuntime] Missing manifest: " << path;
    return false;
  }

  std::optional<base::Value> parsed = base::JSONReader::Read(*manifest_json);
  if (!parsed || !parsed->is_dict()) {
    LOG(ERROR) << "[ModRuntime] Could not parse manifest: " << path;
    return false;
  }

  *out_dict = std::move(parsed->GetDict());
  return true;
}

bool ModRuntime::ValidateManifest(const base::Value::Dict& manifest_dict,
                                  const base::FilePath& mod_root,
                                  ModManifest* out_manifest) const {
  ModManifest manifest;

  if (!DictString(manifest_dict, "id", &manifest.id) ||
      !DictString(manifest_dict, "name", &manifest.name) ||
      !DictString(manifest_dict, "version", &manifest.version) ||
      !DictString(manifest_dict, "author", &manifest.author) ||
      !DictString(manifest_dict, "description", &manifest.description) ||
      !DictString(manifest_dict, "license", &manifest.license) ||
      !DictString(manifest_dict, "fennec_min_version",
                  &manifest.fennec_min_version)) {
    LOG(ERROR) << "[ModRuntime] Manifest missing required fields.";
    return false;
  }

  if (!IsLicenseCompatible(manifest.license)) {
    LOG(ERROR) << "[ModRuntime] Rejecting non-GPL-compatible mod: "
               << manifest.id << " (" << manifest.license << ")";
    return false;
  }

  const base::Value::List* surfaces = manifest_dict.FindList("surfaces");
  if (!surfaces || !ParseSurfaces(*surfaces, &manifest.surfaces)) {
    LOG(ERROR) << "[ModRuntime] Invalid surfaces for mod: " << manifest.id;
    return false;
  }

  if (const std::string* css = manifest_dict.FindString("css"))
    manifest.css = *css;
  if (const std::string* js = manifest_dict.FindString("js"))
    manifest.js = *js;

  if (const base::Value::Dict* panel = manifest_dict.FindDict("panel")) {
    ModPanelConfig panel_config;
    if (!DictString(*panel, "title", &panel_config.title) ||
        !DictString(*panel, "icon", &panel_config.icon) ||
        !DictString(*panel, "entry", &panel_config.entry)) {
      LOG(ERROR) << "[ModRuntime] Invalid panel block for mod: " << manifest.id;
      return false;
    }
    manifest.panel = std::move(panel_config);
  }

  if (const base::Value::Dict* tokens = manifest_dict.FindDict("tokens")) {
    for (const auto item : *tokens) {
      if (!item.second.is_string()) {
        LOG(ERROR) << "[ModRuntime] Token override must be a string: "
                   << item.first;
        return false;
      }
      manifest.tokens[item.first] = item.second.GetString();
    }
  }

  if (const base::Value::Dict* layout = manifest_dict.FindDict("layout")) {
    ModLayoutConfig config;
    const std::string* preset_name = layout->FindString("presetName");
    const base::Value::Dict* layout_config = layout->FindDict("config");
    const base::Value::Dict* sidebar = layout_config ? layout_config->FindDict("sidebar")
                                                     : nullptr;
    if (!preset_name || !layout_config || !sidebar) {
      LOG(ERROR) << "[ModRuntime] Invalid layout block for mod: " << manifest.id;
      return false;
    }

    const std::string* sidebar_position = sidebar->FindString("position");
    const std::string* sidebar_display_mode =
        sidebar->FindString("displayMode");
    const std::string* toolbar_position =
        layout_config->FindString("toolbar");
    const std::string* address_bar_position =
        layout_config->FindString("addressBar");
    const std::string* journal_panel_position =
        layout_config->FindString("journalPanel");
    const std::optional<bool> split_view_default =
        layout_config->FindBool("splitViewDefault");

    if (!sidebar_position || !sidebar_display_mode || !toolbar_position ||
        !address_bar_position || !journal_panel_position ||
        !split_view_default.has_value()) {
      LOG(ERROR) << "[ModRuntime] Incomplete layout block for mod: "
                 << manifest.id;
      return false;
    }

    config.sidebar_position = *sidebar_position;
    config.sidebar_display_mode = *sidebar_display_mode;
    config.toolbar_position = *toolbar_position;
    config.address_bar_position = *address_bar_position;
    config.journal_panel_position = *journal_panel_position;
    config.split_view_default = *split_view_default;
    manifest.layout = std::move(config);
  }

  if (!LoadTextAssetIfPresent(mod_root, manifest.css, nullptr) ||
      !LoadTextAssetIfPresent(mod_root, manifest.js, nullptr) ||
      !LoadPanelAssetIfPresent(mod_root, manifest.panel, nullptr)) {
    LOG(ERROR) << "[ModRuntime] Mod assets missing for " << manifest.id;
    return false;
  }

  *out_manifest = std::move(manifest);
  return true;
}

bool ModRuntime::IsLicenseCompatible(const std::string& license) const {
  static constexpr const char* kCompatibleLicenses[] = {
      "GPL-3.0",         "GPL-3.0-only",      "GPL-3.0-or-later",
      "AGPL-3.0",        "AGPL-3.0-only",     "AGPL-3.0-or-later",
      "LGPL-3.0",        "LGPL-3.0-only",     "LGPL-3.0-or-later",
  };

  for (const char* candidate : kCompatibleLicenses) {
    if (license == candidate)
      return true;
  }
  return false;
}

bool ModRuntime::ParseSurfaces(const base::Value::List& list,
                               std::vector<ModSurface>* out_surfaces) const {
  for (const base::Value& item : list) {
    if (!item.is_string())
      return false;
    std::optional<ModSurface> parsed = ModSurfaceFromString(item.GetString());
    if (!parsed.has_value())
      return false;
    out_surfaces->push_back(*parsed);
  }
  return !out_surfaces->empty();
}

bool ModRuntime::LoadTextAssetIfPresent(
    const base::FilePath& root,
    const std::optional<std::string>& relative_path,
    std::map<std::string, std::string>* out_assets) const {
  if (!relative_path)
    return true;

  const base::FilePath file = root.AppendASCII(*relative_path);
  std::optional<std::string> contents = ReadTextFile(file);
  if (!contents)
    return false;

  if (out_assets)
    (*out_assets)[*relative_path] = *contents;
  return true;
}

bool ModRuntime::LoadPanelAssetIfPresent(
    const base::FilePath& root,
    const std::optional<ModPanelConfig>& panel,
    std::map<std::string, std::string>* out_assets) const {
  if (!panel)
    return true;
  return LoadTextAssetIfPresent(root, panel->entry, out_assets);
}

}  // namespace fennec
