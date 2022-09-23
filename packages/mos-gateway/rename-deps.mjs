// This file replaces the dependencies that are used for building with the ones that will be used by consumers of the library after publish

import fs from 'fs'

const packageFile = JSON.parse(fs.readFileSync('package.json'))
const version = packageFile.version
packageFile.dependencies['@sofie-automation/server-core-integration'] = `npm:@evs/server-core-integration@${version}`
packageFile.dependencies['@sofie-automation/shared-lib'] = `npm:@evs/shared-lib@${version}`

fs.writeFileSync('package.json', JSON.stringify(packageFile, null, 4))
