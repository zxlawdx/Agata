# Fabric.js 5.3.0 — runtime offline

Unmodified `package/dist/fabric.min.js` from https://registry.npmjs.org/fabric/-/fabric-5.3.0.tgz,
renamed `fabric.js` to preserve the application's static URL. MIT license is in FABRIC-LICENSE.txt.
SHA-256: `48f8f0915beb512fc7fe1b48c0eeb075dd0803c790efdfd75cd007f9c3eea2ca`.

The exact npm distribution reports `fabric.version === "5.3.0"`. The GitHub v5.3.0 tag's
prebuilt dist and cdnjs 5.3.0 artifact report 5.1.0; they were inspected but were not incorporated.
The runtime never downloads this dependency. To verify locally:
`python -c "from apps.sketch_editor.services.vendor import verify_vendor; verify_vendor()"`.
Node is optional for development; do not regenerate this file silently. Updating it requires
reviewing source, version, license, hash, browser tests and this record together.
