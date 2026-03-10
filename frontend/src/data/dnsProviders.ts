export interface DnsProvider {
  id: string
  name: string
  icon: string
  color: string
  dnsManagementUrl: string | ((domain: string) => string)
  instructions: {
    cname: string[]
    txt: string[]
  }
  notes?: string
}

export const DNS_PROVIDERS: DnsProvider[] = [
  {
    id: 'cloudflare',
    name: 'Cloudflare',
    icon: 'tabler-cloud',
    color: '#F6821F',
    dnsManagementUrl: 'https://dash.cloudflare.com/',
    instructions: {
      cname: [
        'Log in to your Cloudflare dashboard',
        'Select your domain from the account home',
        'Go to DNS > Records',
        'Click "Add record"',
        'Set Type to CNAME',
        'Enter the Name and Target values shown below',
        'Set Proxy status to "DNS only" (grey cloud icon)',
        'Click Save'
      ],
      txt: [
        'In the same DNS Records page, click "Add record"',
        'Set Type to TXT',
        'Set Name to "@"',
        'Paste the value shown below into the Content field',
        'Click Save'
      ]
    },
    notes: 'Important: Set proxy status to "DNS only" (grey cloud) for the CNAME record. Orange cloud (proxied) will cause verification to fail.'
  },
  {
    id: 'godaddy',
    name: 'GoDaddy',
    icon: 'tabler-world',
    color: '#1BDBDB',
    dnsManagementUrl: (domain: string) => `https://dcc.godaddy.com/manage/${domain}/dns`,
    instructions: {
      cname: [
        'Log in to your GoDaddy account',
        'Go to My Products > Domains',
        'Click DNS next to your domain',
        'Click "Add New Record"',
        'Select CNAME as the record type',
        'Enter the Name and Value shown below',
        'Set TTL to 1 Hour',
        'Click Save'
      ],
      txt: [
        'Click "Add New Record" again',
        'Select TXT as the record type',
        'Set Name to "@"',
        'Paste the value shown below',
        'Set TTL to 1 Hour',
        'Click Save'
      ]
    }
  },
  {
    id: 'namecheap',
    name: 'Namecheap',
    icon: 'tabler-letter-n',
    color: '#DE3723',
    dnsManagementUrl: (domain: string) => `https://ap.www.namecheap.com/Domains/DomainControlPanel/${domain}/advancedns`,
    instructions: {
      cname: [
        'Log in to your Namecheap account',
        'Go to Domain List and click "Manage" next to your domain',
        'Click the "Advanced DNS" tab',
        'Click "Add New Record"',
        'Select CNAME Record from the dropdown',
        'Enter the Host and Value shown below',
        'Click the green checkmark to save'
      ],
      txt: [
        'Click "Add New Record" again',
        'Select TXT Record from the dropdown',
        'Set Host to "@"',
        'Paste the value shown below',
        'Click the green checkmark to save'
      ]
    },
    notes: 'In Namecheap, the "Host" field is the record name. Use "@" for the root domain.'
  },
  {
    id: 'google-domains',
    name: 'Google Domains',
    icon: 'tabler-brand-google',
    color: '#4285F4',
    dnsManagementUrl: (domain: string) => `https://domains.google.com/registrar/${domain}/dns`,
    instructions: {
      cname: [
        'Log in to Google Domains',
        'Select your domain',
        'Click "DNS" in the left sidebar',
        'Scroll to "Custom records"',
        'Click "Manage custom records"',
        'Click "Create new record"',
        'Set Type to CNAME',
        'Enter the Host name and Data values shown below',
        'Click Save'
      ],
      txt: [
        'Click "Create new record" again',
        'Set Type to TXT',
        'Leave Host name as "@" or empty',
        'Paste the value shown below into the Data field',
        'Click Save'
      ]
    }
  },
  {
    id: 'porkbun',
    name: 'Porkbun',
    icon: 'tabler-pig',
    color: '#F27999',
    dnsManagementUrl: (domain: string) => `https://porkbun.com/account/domainsSpe498/${domain}`,
    instructions: {
      cname: [
        'Log in to your Porkbun account',
        'Go to Domain Management',
        'Click the DNS icon next to your domain',
        'Click "Add Record"',
        'Select CNAME as the type',
        'Enter the Host and Answer values shown below',
        'Click Save'
      ],
      txt: [
        'Click "Add Record" again',
        'Select TXT as the type',
        'Leave Host blank (for root domain)',
        'Paste the value shown below into the Answer field',
        'Click Save'
      ]
    }
  },
  {
    id: 'dynadot',
    name: 'Dynadot',
    icon: 'tabler-letter-d',
    color: '#FF6600',
    dnsManagementUrl: 'https://www.dynadot.com/account/domain/setting/dns.html',
    instructions: {
      cname: [
        'Log in to your Dynadot account',
        'Go to My Domains > Manage',
        'Click on your domain name',
        'Click the "DNS" tab',
        'Under "DNS Records", click "Add DNS Record"',
        'Select CNAME as the record type',
        'Enter the Subdomain and Target values shown below',
        'Click Save DNS'
      ],
      txt: [
        'Click "Add DNS Record" again',
        'Select TXT as the record type',
        'Leave Subdomain blank (for root)',
        'Paste the value shown below',
        'Click Save DNS'
      ]
    }
  },
  {
    id: 'bluehost',
    name: 'Bluehost',
    icon: 'tabler-server',
    color: '#003DA5',
    dnsManagementUrl: 'https://my.bluehost.com/hosting/app#/domains',
    instructions: {
      cname: [
        'Log in to your Bluehost control panel',
        'Go to Domains from the side navigation',
        'Click on your domain, then "DNS"',
        'Scroll to "CNAME" section',
        'Click "Add Record"',
        'Enter the Host Record and Points To values shown below',
        'Click Save'
      ],
      txt: [
        'Scroll to the "TXT" section',
        'Click "Add Record"',
        'Set Host Record to "@"',
        'Paste the value shown below into the TXT Value field',
        'Click Save'
      ]
    }
  },
  {
    id: 'hostinger',
    name: 'Hostinger',
    icon: 'tabler-letter-h',
    color: '#673DE6',
    dnsManagementUrl: (domain: string) => `https://hpanel.hostinger.com/domain/${domain}/dns`,
    instructions: {
      cname: [
        'Log in to your Hostinger hPanel',
        'Go to Domains and select your domain',
        'Click "DNS / Nameservers"',
        'In the DNS Records section, click "Add Record"',
        'Select CNAME as the type',
        'Enter the Name and Target values shown below',
        'Click "Add Record"'
      ],
      txt: [
        'Click "Add Record" again',
        'Select TXT as the type',
        'Set Name to "@"',
        'Paste the value shown below into the TXT Value field',
        'Click "Add Record"'
      ]
    }
  },
  {
    id: 'dreamhost',
    name: 'DreamHost',
    icon: 'tabler-moon-stars',
    color: '#0073EC',
    dnsManagementUrl: 'https://panel.dreamhost.com/index.cgi?tree=domain.dns',
    instructions: {
      cname: [
        'Log in to your DreamHost panel',
        'Navigate to Domains > DNS',
        'Select your domain from the list',
        'Click "Add Record"',
        'Select CNAME as the record type',
        'Enter the Name and Value shown below',
        'Click "Add Record Now!"'
      ],
      txt: [
        'Click "Add Record" again',
        'Select TXT as the record type',
        'Leave Name blank (for root domain)',
        'Paste the value shown below',
        'Click "Add Record Now!"'
      ]
    }
  },
  {
    id: 'aws-route53',
    name: 'AWS Route 53',
    icon: 'tabler-brand-aws',
    color: '#FF9900',
    dnsManagementUrl: 'https://console.aws.amazon.com/route53/v2/hostedzones',
    instructions: {
      cname: [
        'Log in to the AWS Console',
        'Navigate to Route 53 > Hosted zones',
        'Click on your domain\'s hosted zone',
        'Click "Create record"',
        'Enter the Record name (subdomain part only)',
        'Set Record type to CNAME',
        'Enter the Value shown below',
        'Click "Create records"'
      ],
      txt: [
        'Click "Create record" again',
        'Leave Record name empty (for root domain)',
        'Set Record type to TXT',
        'Enter the value shown below wrapped in double quotes',
        'Click "Create records"'
      ]
    },
    notes: 'In Route 53, TXT record values must be wrapped in double quotes (e.g., "v=spf1 ...").'
  },
  {
    id: 'other',
    name: 'Other / Not listed',
    icon: 'tabler-help-circle',
    color: '#9e9e9e',
    dnsManagementUrl: '',
    instructions: {
      cname: [
        'Log in to your DNS provider\'s dashboard',
        'Find the DNS management section for your domain',
        'Add a new CNAME record',
        'Set the host/name to the value shown below',
        'Set the value/target to the value shown below',
        'Save the record'
      ],
      txt: [
        'Add a new TXT record',
        'Set the host/name to "@" or leave it blank (varies by provider)',
        'Paste the value shown below',
        'Save the record'
      ]
    }
  }
]

export function getProviderDnsUrl(provider: DnsProvider, domain: string): string {
  if (typeof provider.dnsManagementUrl === 'function') {
    return provider.dnsManagementUrl(domain)
  }

  return provider.dnsManagementUrl
}
