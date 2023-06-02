rm -f $HOME/.npmrc
echo "email=${NPM_USER}@evs.com" >> $HOME/.npmrc
echo "always-auth=true" >> $HOME/.npmrc
echo "@evs:registry=${NPM_REGISTRY_SNAPSHOT}" >> $HOME/.npmrc
echo "//${NPM_REGISTRY_SNAPSHOT}/:_auth=${NPM_AUTH_TOKEN}" >> $HOME/.npmrc
echo "//${NPM_REGISTRY_SNAPSHOT}/:_password=${NPM_ENCODED_PASSWORD}" >> $HOME/.npmrc
echo "//${NPM_REGISTRY_SNAPSHOT}/:username=${NPM_USER}" >> $HOME/.npmrc
echo "//${NPM_REGISTRY_SNAPSHOT}/:email=${NPM_USER}@evs.com" >> $HOME/.npmrc
echo "//${NPM_REGISTRY_SNAPSHOT}/:always-auth=true" >> $HOME/.npmrc
