#!/bin/bash

if [ -d "/host-ssh" ]; then
    echo "Installing private ssh keys..."
    mkdir /root/.ssh
    cp -R /host-ssh/* /root/.ssh
    chmod -R 600 /root/.ssh/*.key
fi

echo "Configuring OCI CLI"
mkdir -p /root/.oci
if [ ! -f /root/.oci/config ]; then
    cat > /root/.oci/config <<EOF
[DEFAULT]
user=${USER_OCID}
fingerprint=${FINGERPRINT}
tenancy=${TENANCY_OCID}
region=${REGION}
key_file=${PRIVATE_KEY_PATH}
EOF
    chmod 600 /root/.oci/config
fi

echo "Installing Ansible requirements"
cd /code/oci-free/configuration
ansible-galaxy install -r requirements.yml

echo "Installing Pulumi"
cd /code/oci-free/infrastructure
npm install

echo "Go to pulumi"
pulumi stack init oci-free
status=$?
if test $status -eq 0
then
    echo "Stack created!"
else
    echo "Stack already exists. Select it!"
fi
pulumi stack select oci-free

pulumi config set oci:userOcid ${USER_OCID}
pulumi config set oci:fingerprint ${FINGERPRINT}
pulumi config set oci:tenancyOcid ${TENANCY_OCID}
pulumi config set oci:privateKeyPath ${PRIVATE_KEY_PATH}
pulumi config set oci:region ${REGION}

cd /code/oci-free
bash