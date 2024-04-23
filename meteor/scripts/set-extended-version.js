const fs = require('fs')
const path = require('path')

if (process.argv.length < 3) {
    console.error('Expected one argument')
    process.exit(1)
}

const pkgPath = path.join(__dirname, '../package.json')
const pkg = JSON.parse(fs.readFileSync(pkgPath))

const extendedVersionTag = process.argv[2]
pkg.versionExtended = `${pkg.version}-${extendedVersionTag}`
console.log('VersionExtended:', pkg.versionExtended)

fs.writeFileSync(pkgPath, JSON.stringify(pkg, undefined, 2))
