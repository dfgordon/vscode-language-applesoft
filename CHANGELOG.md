# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.3.0] - 2025-09-27

### Fixes

* Fix a problem with minifier level 3

### New Features

* Handles WOZ images that have been written to by MAME

## [2.2.0] - 2025-03-22

### Fixes

* Strings with multiple hex-escapes are highlighted correctly

### New Features

* Minifier level 1 handles wider range of unnecessary separators
* Minifier level 2 removes lines with only `REM`
* Minifier level 3 combines lines where possible

## [2.1.0] - 2024-11-30

### New Features

* Control of minification level
* Detection of RUN in relocation flows

### Fixes

* Fix some issues with white-space-only lines

## [2.0.0] - 2024-09-29

### New Features

* Language server is native rust code
* Expanded language diagnostics
    - identifies and error checks interprogram branching
    - identifies and optionally accepts extended CALL syntax
* Disk image support is bundled, no need for external `a2kit` installation
* User control of diagnostic severity

### Breaking Changes

* Goto references will not overlap with goto definitions or declarations
* Some options have changed from boolean to an enumerated severity level
* Platform support works differently
    - Out of the box support for Linux-x64, Mac-x64, Mac-aarch64, and Windows-x64, everything needed is bundled.
    - Universal version requires an external `a2kit` installation, not only for disk images, but for all services.
