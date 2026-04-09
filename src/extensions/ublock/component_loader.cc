// Copyright 2024 The Fennec Authors. All rights reserved.
// Use of this source code is governed by a GPL-3.0 license.

#include "fennec/extensions/ublock/component_loader.h"

#include "base/files/file_util.h"
#include "base/json/json_file_value_serializer.h"
#include "base/logging.h"
#include "base/path_service.h"
#include "chrome/browser/extensions/component_loader.h"
#include "extensions/common/constants.h"

namespace fennec {

namespace {

constexpr char kExtensionsDirName[] = "extensions";
constexpr char kUBlockDirName[]     = "ublock";

// Returns the expected version string from the bundle's manifest.json.
// Returns an empty string on parse failure.
std::string ReadBundleVersion(const base::FilePath& bundle_path) {
  base::FilePath manifest_path =
      bundle_path.Append(extensions::kManifestFilename);

  JSONFileValueDeserializer deserializer(manifest_path);
  int error_code = 0;
  std::string error_msg;
  std::unique_ptr<base::Value> value =
      deserializer.Deserialize(&error_code, &error_msg);

  if (!value || !value->is_dict()) {
    LOG(WARNING) << "[UBlockComponentLoader] Cannot parse manifest at "
                 << manifest_path << ": " << error_msg;
    return "";
  }

  const std::string* version =
      value->GetDict().FindString("version");
  return version ? *version : "";
}

}  // namespace

UBlockComponentLoader::UBlockComponentLoader() = default;

// static
base::FilePath UBlockComponentLoader::GetBundlePath(
    const base::FilePath& app_resources_dir) {
  return app_resources_dir
      .AppendASCII(kExtensionsDirName)
      .AppendASCII(kUBlockDirName);
}

// static
bool UBlockComponentLoader::ValidateBundle(const base::FilePath& bundle_path) {
  if (!base::DirectoryExists(bundle_path)) {
    LOG(WARNING) << "[UBlockComponentLoader] Bundle directory not found: "
                 << bundle_path;
    return false;
  }

  const std::string version = ReadBundleVersion(bundle_path);
  if (version.empty()) {
    LOG(WARNING) << "[UBlockComponentLoader] Cannot read bundle version.";
    return false;
  }

  if (version != kUBlockBundledVersion) {
    LOG(WARNING) << "[UBlockComponentLoader] Version mismatch: expected "
                 << kUBlockBundledVersion << ", got " << version;
    return false;
  }

  LOG(INFO) << "[UBlockComponentLoader] Bundle validated: v" << version
            << " at " << bundle_path;
  return true;
}

void UBlockComponentLoader::RegisterExtension(
    extensions::ComponentLoader* loader,
    const base::FilePath& app_resources_dir) {
  DCHECK(loader);

  base::FilePath bundle_path = GetBundlePath(app_resources_dir);

  if (!ValidateBundle(bundle_path)) {
    LOG(ERROR) << "[UBlockComponentLoader] Bundle validation failed. "
               << "uBlock Origin will not be loaded. "
               << "Run `fennec bootstrap` to download the extension bundle.";
    return;
  }

  // Register as a component extension loaded from the local bundle path.
  // The extension ID is hard-coded to match the published CWS release so
  // that existing uBO user data (custom filters, settings) carries over.
  loader->Add(base::StringPrintf(
      R"json({
        "id":            "%s",
        "path":          "%s",
        "version":       "%s",
        "manifest_path": "%s"
      })json",
      kUBlockExtensionId,
      bundle_path.AsUTF8Unsafe().c_str(),
      kUBlockBundledVersion,
      bundle_path.Append(FILE_PATH_LITERAL("manifest.json"))
          .AsUTF8Unsafe()
          .c_str()),
      bundle_path);

  LOG(INFO) << "[UBlockComponentLoader] Registered uBlock Origin v"
            << kUBlockBundledVersion << " (id=" << kUBlockExtensionId << ").";
}

}  // namespace fennec
