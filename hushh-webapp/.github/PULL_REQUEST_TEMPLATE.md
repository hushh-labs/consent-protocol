## Description

Brief description of what this PR does.

## Type of Change

- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Checklist

### General
- [ ] Code compiles without warnings
- [ ] Self-reviewed the changes
- [ ] Added/updated comments for complex logic

### Native Plugin Changes

> **If this PR touches any files in `ios/App/App/Plugins/` or `android/app/src/main/java/.../plugins/`:**

- [ ] Verified TypeScript interface matches (`lib/capacitor/index.ts` or `lib/capacitor/kai.ts`)
- [ ] Android implementation uses EXACT same parameter names as TypeScript
- [ ] iOS implementation uses EXACT same parameter names as TypeScript
- [ ] HTTP responses validate status code (200-299) before parsing
- [ ] Added debug logging showing received parameter keys
- [ ] Error messages include missing parameter names
- [ ] Tested on iOS simulator
- [ ] Tested on Android emulator
- [ ] Updated `docs/PLUGIN_API_REFERENCE.md` if API changed

### Testing

- [ ] Tested manually on iOS
- [ ] Tested manually on Android
- [ ] Tested on web (if applicable)
- [ ] Existing tests still pass

## Screenshots (if applicable)

| iOS | Android |
|-----|---------|
|     |         |

## Related Issues

Fixes #(issue number)
