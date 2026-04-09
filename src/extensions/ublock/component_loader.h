// Copyright 2024 The Fennec Authors. All rights reserved.
// Use of this source code is governed by a GPL-3.0 license.
//
// UBlockComponentLoader — registers the bundled uBlock Origin MV2 extension
// as a component extension at browser startup.
//
// Unlike regular component extensions, Fennec's uBO bundle is NOT loaded
// from the Google Component Updater service.  It is loaded from a local
// directory that is baked into the application bundle at build time:
//
//   <app_resources_dir>/extensions/ublock/
//
// The extension ID is kept identical to the published CWS version
// (cjpalhdlnbpafiamejdnhcphjbkeiagm) so that user data (custom filters,
// settings) persists if a user migrates from another Chromium-based browser.
//
// Updates are delivered via Fennec releases, not via the component updater.
// This is intentional: every uBO update goes through the Request Journal and
// is visible to the user via fennec://journal (source_tag = "fennec-internal").
//
// Journal integration:
//   UBlockComponentLoader installs a webRequest.onBeforeRequest listener
//   bridge that receives every uBO block/allow decision and forwards it to
//   the JournalInterceptor via the FennecJournalBridge C++ helper.

#ifndef FENNEC_EXTENSIONS_UBLOCK_COMPONENT_LOADER_H_
#define FENNEC_EXTENSIONS_UBLOCK_COMPONENT_LOADER_H_

#include <string>

#include "base/files/file_path.h"
#include "base/memory/weak_ptr.h"

namespace extensions {
class ComponentLoader;
}

namespace fennec {

// Known uBlock Origin extension ID (same as CWS / AMO release).
inline constexpr char kUBlockExtensionId[] = "cjpalhdlnbpafiamejdnhcphjbkeiagm";

// Current pinned version.  Must match manifest.json in the bundle.
inline constexpr char kUBlockBundledVersion[] = "1.59.0";

class UBlockComponentLoader {
 public:
  UBlockComponentLoader();
  ~UBlockComponentLoader() = default;

  UBlockComponentLoader(const UBlockComponentLoader&)            = delete;
  UBlockComponentLoader& operator=(const UBlockComponentLoader&) = delete;

  // Registers uBlock Origin with the given ComponentLoader.
  // Called from ChromeBrowserMainExtraPartsProfiles::PreProfileInit().
  //
  // |app_resources_dir| is the directory that contains the extensions/
  // subdirectory with the ublock/ bundle.
  void RegisterExtension(extensions::ComponentLoader* loader,
                         const base::FilePath& app_resources_dir);

  // Returns the path to the uBO bundle directory.
  static base::FilePath GetBundlePath(const base::FilePath& app_resources_dir);

  // Validates that the bundle exists and has a matching manifest version.
  // Returns false and logs a warning if the bundle is missing or corrupted.
  static bool ValidateBundle(const base::FilePath& bundle_path);

 private:
  base::WeakPtrFactory<UBlockComponentLoader> weak_factory_{this};
};

}  // namespace fennec

#endif  // FENNEC_EXTENSIONS_UBLOCK_COMPONENT_LOADER_H_
