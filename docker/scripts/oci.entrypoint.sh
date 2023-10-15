#!/bin/bash

if [ -d "/host-ssh" ]; then
    echo "Installing private ssh keys..."
    mkdir /root/.ssh
    cp -R /host-ssh/* /root/.ssh
    chmod -R 600 /root/.ssh/*.key
fi

cd oci-free/infrastructure
npm install

pulumi stack init oci-free
pulumi stack select oci-free
# status=$?

# if test $status -eq 0
# then
#     echo "Create the stack!"
#     pulumi stack init oci-free
# else
#     echo "Stack already exists. Select it!"
#     pulumi stack select oci-free
# fi

pulumi config set oci:userOcid ${USER_OCID}
pulumi config set oci:fingerprint ${FINGERPRINT}
pulumi config set oci:tenancyOcid ${TENANCY_OCID}
pulumi config set oci:privateKeyPath ${PRIVATE_KEY_PATH}
pulumi config set oci:region ${REGION}

bash