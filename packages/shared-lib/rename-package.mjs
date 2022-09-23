import fs from 'fs'

const packageFile = JSON.parse(fs.readFileSync('package.json'))
packageFile.name = `@evs/sofie-${packageFile.name.replace('@sofie-automation/', '')}`

fs.writeFileSync('package.json', JSON.stringify(packageFile, null, 4))
