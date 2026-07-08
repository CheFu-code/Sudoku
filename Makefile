# Run `make help` to list available targets.

.DEFAULT_GOAL := help

# App name is derived from the directory, so this file is identical across repos.
APP_NAME := $(notdir $(CURDIR))

# Use npx so the locally pinned Expo/EAS CLIs are used.
EXPO ?= npx expo
EAS  ?= npx eas-cli

# Simulators targeted by `make ios` / `make ipad` (override on the CLI if needed).
# These match the App Store screenshot sizes: 6.9" (1320x2868) and 13" (2064x2752).
IOS_SIM  ?= iPhone 17 Pro Max
IPAD_SIM ?= iPad Pro 13-inch (M4)

.PHONY: help install start web ios ipad ios-device ios-release ios-start android android-start \
        prebuild prebuild-clean \
        test test-watch typecheck lint check \
        build-dev build-preview build-prod submit release \
        build-ios submit-ios publish-ios \
        clean

## help: Show this help.
help:
	@echo "$(APP_NAME) — common commands"
	@echo ""
	@grep -E '^## ' $(MAKEFILE_LIST) | sed 's/## /  make /'

## install: Install JS dependencies.
install:
	npm install

# --- Dev server (Metro) -----------------------------------------------------

## start: Start the Expo dev server (interactive).
start:
	$(EXPO) start

## web: Run the app in a web browser.
web:
	$(EXPO) start --web

## ios: Build (if needed) & run the iOS dev client on IOS_SIM, then start Metro.
ios:
	$(EXPO) run:ios --device "$(IOS_SIM)"

## ipad: Build (if needed) & run the iOS dev client on IPAD_SIM, then start Metro.
ipad:
	$(EXPO) run:ios --device "$(IPAD_SIM)"

## ios-device: Build & install the dev client on a USB-connected iPhone.
ios-device:
	$(EXPO) run:ios --device

## ios-release: Build & install a standalone Release app (JS bundled in, no Metro needed).
ios-release:
	$(EXPO) run:ios --device --configuration Release

## ios-start: Reattach Metro to an already-installed iOS dev build.
ios-start:
	$(EXPO) start --ios

## android: Build (if needed) & run the Android dev client, then start Metro.
android:
	$(EXPO) run:android

## android-start: Reattach Metro to an already-installed Android dev build.
android-start:
	$(EXPO) start --android

# --- Native builds (local, requires Xcode / Android SDK) --------------------

## prebuild: Generate the native ios/ and android/ projects.
prebuild:
	$(EXPO) prebuild

## prebuild-clean: Regenerate native projects from scratch.
prebuild-clean:
	$(EXPO) prebuild --clean

# --- Quality ----------------------------------------------------------------

## test: Run the Jest test suite.
test:
	npm test

## test-watch: Run Jest in watch mode.
test-watch:
	npm test -- --watch

## typecheck: Type-check the project with the TypeScript compiler.
typecheck:
	npx tsc --noEmit

## lint: Lint the project with Expo's ESLint config.
lint:
	$(EXPO) lint

## check: Run typecheck, lint, and tests (full quality gate).
check: typecheck lint test

# --- EAS cloud builds & submission ------------------------------------------

## build-dev: EAS development build (dev client, internal distribution).
build-dev:
	$(EAS) build --profile development

## build-preview: EAS preview build (internal distribution).
build-preview:
	$(EAS) build --profile preview

## build-prod: EAS production build.
build-prod:
	$(EAS) build --profile production

## submit: Submit the latest production build to the app stores.
submit:
	$(EAS) submit --profile production

## release: Tag VERSION and push it (git only, no build). Usage: make release VERSION=1.2.0
release:
	@test -n "$(VERSION)" || { echo "Usage: make release VERSION=1.2.0"; exit 1; }
	git tag v$(VERSION)
	git push origin v$(VERSION)

# --- Manual iOS release (build/submit from the laptop, not CI) --------------

## build-ios: EAS production build for iOS (cloud build, triggered locally).
build-ios:
	$(EAS) build --platform ios --profile production

## submit-ios: Submit the latest iOS production build to App Store Connect.
submit-ios:
	$(EAS) submit --platform ios --profile production --latest

## publish-ios: Sync version from VERSION, then EAS-build & auto-submit iOS. Usage: make publish-ios VERSION=1.2.0
publish-ios:
	@test -n "$(VERSION)" || { echo "Usage: make publish-ios VERSION=1.2.0"; exit 1; }
	npm run set-version v$(VERSION)
	$(EAS) build --platform ios --profile production --auto-submit
	git checkout -- app.json app.config.ts 2>/dev/null || true   # discard the local version bump; the tag is the source of truth

# --- Housekeeping -----------------------------------------------------------

## clean: Remove generated native projects and caches.
clean:
	rm -rf ios android node_modules/.cache .expo
