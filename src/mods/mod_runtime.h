// Copyright 2024 The Fennec Authors. All rights reserved.
// Use of this source code is governed by a GPL-3.0 license.
//
// ModRuntime -- per-profile Fennec Mods loader and sandbox coordinator.
//
// Installed Mods live at:
//   <profile>/fennec-mods/<mod-id>/
//
// Each directory contains:
//   manifest.json
//   optional css/js/panel assets referenced by the manifest
//
// The runtime validates manifests against src/mods/mod.schema.json, rejects
// non-GPL-compatible licenses, surfaces only the explicitly declared WebUI
// pages, and records forbidden API attempts back into the Request Journal.

#ifndef FENNEC_MODS_MOD_RUNTIME_H_
#define FENNEC_MODS_MOD_RUNTIME_H_

#include <map>
#include <optional>
#include <string>
#include <vector>

#include "base/files/file_path.h"
#include "base/values.h"

namespace fennec {

class RequestJournal;

enum class ModSurface {
  kSidebar,
  kNewTab,
  kSettings,
  kJournal,
  kLayout,
};

struct ModPanelConfig {
  std::string title;
  std::string icon;
  std::string entry;
};

struct ModLayoutConfig {
  std::string sidebar_position;
  std::string sidebar_display_mode;
  std::string toolbar_position;
  std::string address_bar_position;
  std::string journal_panel_position;
  bool        split_view_default = false;
};

struct ModManifest {
  std::string                        id;
  std::string                        name;
  std::string                        version;
  std::string                        author;
  std::string                        description;
  std::string                        license;
  std::string                        fennec_min_version;
  std::vector<ModSurface>            surfaces;
  std::optional<std::string>         css;
  std::optional<std::string>         js;
  std::optional<ModPanelConfig>      panel;
  std::map<std::string, std::string> tokens;
  std::optional<ModLayoutConfig>     layout;
};

struct InstalledMod {
  ModManifest                    manifest;
  base::FilePath                 root_path;
  bool                           enabled = true;
  std::map<std::string, std::string> text_assets;
};

class ModRuntime {
 public:
  ModRuntime(const base::FilePath& profile_path, RequestJournal* journal);
  ~ModRuntime();

  ModRuntime(const ModRuntime&) = delete;
  ModRuntime& operator=(const ModRuntime&) = delete;

  bool Initialize();

  const std::vector<InstalledMod>& installed_mods() const { return installed_mods_; }
  std::vector<InstalledMod> GetInstalledModsForSurface(ModSurface surface) const;

  bool InstallArchive(const base::FilePath& archive_path);
  bool InstallArchiveBytes(const std::string& archive_bytes);
  bool SetEnabled(const std::string& mod_id, bool enabled);
  bool Uninstall(const std::string& mod_id);

  std::string BuildInjectedCssForSurface(ModSurface surface) const;
  std::vector<base::Value::Dict> BuildInjectedScriptsForSurface(ModSurface surface) const;
  base::Value::List SerializeInstalledMods() const;

  void RecordViolation(const std::string& mod_id, const std::string& attempted_api);

 private:
  bool EnsureModsDirectory();
  bool LoadInstalledModsFromDisk();
  bool LoadInstalledModAtPath(const base::FilePath& mod_path, InstalledMod* out_mod);
  bool ExtractArchiveToDirectory(const std::string& archive_bytes,
                                 const base::FilePath& destination);
  bool ReadManifest(const base::FilePath& path, base::Value::Dict* out_dict) const;
  bool ValidateManifest(const base::Value::Dict& manifest_dict,
                        const base::FilePath& mod_root,
                        ModManifest* out_manifest) const;
  bool IsLicenseCompatible(const std::string& license) const;
  bool ParseSurfaces(const base::Value::List& list,
                     std::vector<ModSurface>* out_surfaces) const;
  bool LoadTextAssetIfPresent(const base::FilePath& root,
                              const std::optional<std::string>& relative_path,
                              std::map<std::string, std::string>* out_assets) const;
  bool LoadPanelAssetIfPresent(const base::FilePath& root,
                               const std::optional<ModPanelConfig>& panel,
                               std::map<std::string, std::string>* out_assets) const;

  base::FilePath profile_path_;
  base::FilePath mods_root_;
  RequestJournal* journal_ = nullptr;  // Not owned.
  std::vector<InstalledMod> installed_mods_;
};

std::string ModSurfaceToString(ModSurface surface);

}  // namespace fennec

#endif  // FENNEC_MODS_MOD_RUNTIME_H_
