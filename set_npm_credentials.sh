rm -f $HOME/.npmrc
echo "email=${NPM_USER}@evs.com" >> $HOME/.npmrc
echo "@evs:registry=${NPM_REGISTRY_SNAPSHOT}/" >> $HOME/.npmrc
echo "//${NPM_REGISTRY_SNAPSHOT}/:_auth=${NPM_AUTH_TOKEN}" >> $HOME/.npmrc
echo "//${NPM_REGISTRY_SNAPSHOT}/:email=${NPM_USER}@evs.com" >> $HOME/.npmrc
echo "//${NPM_REGISTRY_SNAPSHOT}/:always-auth=true" >> $HOME/.npmrc
