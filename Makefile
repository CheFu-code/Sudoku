# Run `make help` to list available targets.

.DEFAULT_GOAL := help

# Use npx so the locally pinned Expo/EAS CLIs are used.
EXPO ?= npx expo
EAS  ?= npx eas-cli

.PHONY: help install start web ios ios-device ios-release ios-start android android-start \
        prebuild prebuild-clean \
        test test-watch typecheck \
        build-dev build-preview build-prod submit release \
        clean

## help: Show this help.
help:
	@echo "sudoku-oji — common commands"
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

## ios: Build (if needed) & run the iOS dev client, then start Metro.
ios:
	$(EXPO) run:ios

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

## release: Tag VERSION and push it to trigger the CI release pipeline. Usage: make release VERSION=1.2.0
release:
	@test -n "$(VERSION)" || { echo "Usage: make release VERSION=1.2.0"; exit 1; }
	git tag v$(VERSION)
	git push origin v$(VERSION)

# --- Housekeeping -----------------------------------------------------------

## clean: Remove generated native projects and caches.
clean:
	rm -rf ios android node_modules/.cache .expo
