import * as pulumi from "@pulumi/pulumi";
import * as oci from "@pulumi/oci";
import * as fs from "fs";

// VARIABLES AND CONSTANTS
const DEFAULT_TAG = `oci-free`;

const ALL_IP = "0.0.0.0/0";
const VCN_CIDR = "10.10.10.0/24";

enum PORT_NUMBER {
  ssh = 22,
  http = 80,
  https = 443,
}

enum PROTOCOL_NUMBER {
  icmp = "1",
  icmpv6 = "58",
  tcp = "6",
  udp = "17",
}

const VM_OS_NAME = "Canonical Ubuntu";
const VM_OS_VERSION = "22.04";
const VM_SHAPE = "VM.Standard.A1.Flex";
const VM_RAM_SIZE = 24; // GB
const VM_CPUS_NUM = 4;
const VM_BOOT_DISK_SIZE = "100"; // GB

// compartement
const config = new pulumi.Config("oci");
const tenancyOcid = config.requireSecret("tenancyOcid");

const compartment = new oci.identity.Compartment(`${DEFAULT_TAG}-compartment`, {
  compartmentId: tenancyOcid,
  name: DEFAULT_TAG,
  description: "Free tier OCI stack",
  enableDelete: true,
});

// VCN
const freeOciVcn = new oci.core.Vcn(`${DEFAULT_TAG}-vcn`, {
  compartmentId: compartment.id,
  cidrBlocks: [VCN_CIDR],
  displayName: `${DEFAULT_TAG}-vcn`,
  dnsLabel: `vcn`,
  isIpv6enabled: false,
});

// Internet gateway
const internetGateway = new oci.core.InternetGateway(`${DEFAULT_TAG}-ig`, {
  compartmentId: compartment.id,
  vcnId: freeOciVcn.id,
  displayName: `${DEFAULT_TAG}-ig`,
});

// Default Route Table
new oci.core.DefaultRouteTable(`${DEFAULT_TAG}-route-table`, {
  manageDefaultResourceId: freeOciVcn.defaultRouteTableId,
  displayName: `${DEFAULT_TAG}-rt`,
  routeRules: [
    {
      networkEntityId: internetGateway.id,
      description: "Default route table for OCI free",
      destination: ALL_IP,
    },
  ],
});

// Default Security list
new oci.core.DefaultSecurityList(`${DEFAULT_TAG}-security-list`, {
  manageDefaultResourceId: freeOciVcn.defaultSecurityListId,
  ingressSecurityRules: [
    {
      protocol: PROTOCOL_NUMBER.tcp,
      source: ALL_IP,
      description: `SSH from any origin`,
      tcpOptions: {
        min: PORT_NUMBER.ssh,
        max: PORT_NUMBER.ssh,
      },
    },
    {
      protocol: PROTOCOL_NUMBER.tcp,
      source: ALL_IP,
      description: `HTTP from any origin`,
      tcpOptions: {
        min: PORT_NUMBER.http,
        max: PORT_NUMBER.http,
      },
    },
    {
      protocol: PROTOCOL_NUMBER.tcp,
      source: ALL_IP,
      description: `HTTPS from any origin`,
      tcpOptions: {
        min: PORT_NUMBER.https,
        max: PORT_NUMBER.https,
      },
    },
  ],
  egressSecurityRules: [
    {
      destination: ALL_IP,
      protocol: "all",
      description: "All traffic to any destination",
    },
  ],
});

// Subnet
const subnet = new oci.core.Subnet(`${DEFAULT_TAG}-subnet`, {
  compartmentId: compartment.id,
  vcnId: freeOciVcn.id,
  cidrBlock: VCN_CIDR,
  displayName: `${DEFAULT_TAG}-subnet`,
  dnsLabel: `subnet`,
});

// Network security group and rule
const networkSecurityGroup = new oci.core.NetworkSecurityGroup(
  `${DEFAULT_TAG}-sg`,
  {
    compartmentId: compartment.id,
    vcnId: freeOciVcn.id,
    displayName: `${DEFAULT_TAG}-sg`,
  }
);

new oci.core.NetworkSecurityGroupSecurityRule(`${DEFAULT_TAG}-sg-rule`, {
  direction: "INGRESS",
  networkSecurityGroupId: networkSecurityGroup.id,
  protocol: PROTOCOL_NUMBER.icmp,
  source: ALL_IP,
});

// Image
const images = oci.core.getImagesOutput({
  compartmentId: compartment.id,
  operatingSystem: VM_OS_NAME,
  operatingSystemVersion: VM_OS_VERSION,
  shape: VM_SHAPE,
  sortBy: "TIMECREATED",
  sortOrder: "DESC",
  state: "available",
  filters: [
    {
      name: "display_name",
      values: ["^.*-aarch64-.*$"],
      regex: true,
    },
  ],
});

// Instance
const userData = fs.readFileSync(`/code/oci-free/cloud-init/cloud-init.yaml`, {
  encoding: "base64",
});
const pubKeyFile = fs.readFileSync(`${process.env.INSTANCE_PUBLIC_KEY_NAME}`, {
  encoding: "utf-8",
});

const identityDomains = oci.identity.getAvailabilityDomainsOutput({
  compartmentId: tenancyOcid,
});

const instance = new oci.core.Instance(`${DEFAULT_TAG}-instance`, {
  availabilityDomain: identityDomains.availabilityDomains[0].name,
  compartmentId: compartment.id,
  shape: VM_SHAPE,
  displayName: `${DEFAULT_TAG}-instance`,
  preserveBootVolume: false,
  metadata: {
    ssh_authorized_keys: pubKeyFile,
    user_data: userData,
  },
  agentConfig: {
    areAllPluginsDisabled: true,
    isManagementDisabled: true,
    isMonitoringDisabled: true,
  },
  availabilityConfig: {
    isLiveMigrationPreferred: false,
  },
  createVnicDetails: {
    assignPublicIp: "false",
    displayName: `${DEFAULT_TAG}-instance`,
    hostnameLabel: `${DEFAULT_TAG}-instance`,
    nsgIds: [networkSecurityGroup.id],
    subnetId: subnet.id,
  },
  shapeConfig: {
    memoryInGbs: VM_RAM_SIZE,
    ocpus: VM_CPUS_NUM,
  },
  sourceDetails: {
    sourceId: images.images[0].id,
    sourceType: "image",
    bootVolumeSizeInGbs: VM_BOOT_DISK_SIZE,
  },
});

// Private Instance IP
const privateIps = oci.core.getPrivateIpsOutput({
  ipAddress: instance.privateIp,
  subnetId: subnet.id,
});

// Public Instance IP
new oci.core.PublicIp(`${DEFAULT_TAG}-pub-ip`, {
  compartmentId: compartment.id,
  lifetime: "RESERVED",
  displayName: `${DEFAULT_TAG}-pub-ip`,
  privateIpId: privateIps.privateIps[0].id,
});

// Instance Volume Backup
const volumeBackupPolicy = new oci.core.VolumeBackupPolicy(
  `${DEFAULT_TAG}-bck-policy`,
  {
    compartmentId: compartment.id,
    displayName: "Daily 1",
    schedules: [
      {
        backupType: "INCREMENTAL",
        hourOfDay: 1,
        offsetType: "STRUCTURED",
        period: "ONE_DAY",
        retentionSeconds: 86400,
        timeZone: "REGIONAL_DATA_CENTER_TIME",
      },
    ],
  }
);

new oci.core.VolumeBackupPolicyAssignment(
  `${DEFAULT_TAG}-bck-policy-assignment`,
  {
    assetId: instance.bootVolumeId,
    policyId: volumeBackupPolicy.id,
  }
);
