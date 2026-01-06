# Azure 4-VM (Private IP) Deployment — Step by Step (CMD + SSH)

Target architecture:
- VM1: Frontend + Backend (public IP)
- VM2: etcd1 + MinIO1 (private IP only)
- VM3: etcd2 + MinIO2 (private IP only)
- VM4: etcd3 + MinIO3 (private IP only)

This guide uses **private IPs for all cluster communication**. Only VM1 needs a public IP.

## 0) Prereqs (your Windows CMD)
- Azure CLI logged in: `az login`
- SSH key exists (Azure CLI creates one with `--generate-ssh-keys`)

## 1) Create Resource Group + VNet (CMD)
If you already did these, skip.

```cmd
az group create --name dsResourceGroup --location eastus
az network vnet create --resource-group dsResourceGroup --name dsVNet --address-prefix 10.0.0.0/16 --subnet-name dsSubnet --subnet-prefix 10.0.0.0/24
```

## 2) Create VMs (CMD)
IMPORTANT: `Standard_B2ats_v2` may be unavailable. Use `Standard_B1s` (or any size that works in your region).

VM1 (public IP):
```cmd
az vm create --resource-group dsResourceGroup --name VM1 --image Ubuntu2204 --size Standard_B1s --admin-username azureuser --generate-ssh-keys --vnet-name dsVNet --subnet dsSubnet
```

VM2/VM3/VM4 (NO public IP):
```cmd
az vm create --resource-group dsResourceGroup --name VM2 --image Ubuntu2204 --size Standard_B1s --admin-username azureuser --generate-ssh-keys --vnet-name dsVNet --subnet dsSubnet --public-ip-address ""
az vm create --resource-group dsResourceGroup --name VM3 --image Ubuntu2204 --size Standard_B1s --admin-username azureuser --generate-ssh-keys --vnet-name dsVNet --subnet dsSubnet --public-ip-address ""
az vm create --resource-group dsResourceGroup --name VM4 --image Ubuntu2204 --size Standard_B1s --admin-username azureuser --generate-ssh-keys --vnet-name dsVNet --subnet dsSubnet --public-ip-address ""
```

Note: if you copy/paste, ensure the VM3 line is `az vm create ...` (not `az` with a different character).

### 2.1) (Optional) Free public IP quota: remove public IPs from VM2/VM3
If your subscription only allows 3 public IPs, keep VM1 public and make VM2/VM3 private-only.

PowerShell (recommended if your prompt shows `PS ...>`):
```powershell
$rg = "dsResourceGroup"

foreach ($vm in @("VM2","VM3")) {
  $nicId = az vm show -g $rg -n $vm --query "networkProfile.networkInterfaces[0].id" -o tsv

  # Parse NIC name + RG from the NIC resource ID
  $parts = $nicId -split "/"
  $nicRg = $parts[($parts.IndexOf("resourceGroups") + 1)]
  $nicName = $parts[($parts.IndexOf("networkInterfaces") + 1)]

  $ipcfgName = az network nic ip-config list -g $nicRg --nic-name $nicName --query "[0].name" -o tsv
  az network nic ip-config update -g $nicRg --nic-name $nicName -n $ipcfgName --remove publicIpAddress
}
```

CMD (only if you're in Command Prompt `cmd.exe`):
```cmd
for %V in (VM2 VM3) do @for /f "delims=" %NICID in ('az vm show -g dsResourceGroup -n %V --query "networkProfile.networkInterfaces[0].id" -o tsv') do @for /f "tokens=5,9 delims=/" %RG in ("%NICID%") do @for /f "delims=" %IPCFG in ('az network nic ip-config list -g %RG --nic-name %I --query "[0].name" -o tsv') do @az network nic ip-config update -g %RG --nic-name %I -n %IPCFG --remove publicIpAddress
```

## 3) Open ports on VM1 (CMD)
Open HTTP/HTTPS + backend API (5000) + SSH.

If you get `(SecurityRuleConflict) ... Rules cannot have the same Priority`, re-run using explicit priorities like below.

```cmd
az vm open-port --resource-group dsResourceGroup --name VM1 --port 22 --priority 1010
az vm open-port --resource-group dsResourceGroup --name VM1 --port 80 --priority 1020
az vm open-port --resource-group dsResourceGroup --name VM1 --port 443 --priority 1030
az vm open-port --resource-group dsResourceGroup --name VM1 --port 5000 --priority 1040
```

For VM2/3/4: you do NOT need public ports (they have no public IP).
If you accidentally run `az vm open-port` on VM2/3/4 and see a CLI crash like `KeyError: 'networkSecurityGroup'`, ignore it and continue — those VMs are private-only.

## 4) Get IPs (CMD)
```cmd
az vm list-ip-addresses --resource-group dsResourceGroup --output table
```
Write down:
- VM1 public IP
- VM2 private IP
- VM3 private IP
- VM4 private IP

We will refer to them as:
- `<VM1_PUBLIC>`
- `<VM2_PRIV>`
- `<VM3_PRIV>`
- `<VM4_PRIV>`

## 5) SSH into VM1, then hop to others (CMD)
```cmd
ssh azureuser@<VM1_PUBLIC>
```

Important: VM1 does NOT have your private key by default, so `ssh azureuser@<VM2_PRIV>` from inside VM1 may fail with `Permission denied (publickey)`.

Recommended options:

Option A (easiest): SSH directly from your PC using ProxyJump (one command per VM):
```cmd
ssh -J azureuser@<VM1_PUBLIC> azureuser@<VM2_PRIV>
ssh -J azureuser@<VM1_PUBLIC> azureuser@<VM3_PRIV>
ssh -J azureuser@<VM1_PUBLIC> azureuser@<VM4_PRIV>
```

Option B: SSH to VM1 with agent forwarding, then hop (requires your local `ssh-agent` running and key added):
```cmd
ssh -A azureuser@<VM1_PUBLIC>
```
Then inside VM1:
```bash
ssh azureuser@<VM2_PRIV>
ssh azureuser@<VM3_PRIV>
ssh azureuser@<VM4_PRIV>
```

## 6) Install Docker + Compose on ALL VMs (run on each VM)
On VM1, VM2, VM3, VM4 (repeat):

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo \"$VERSION_CODENAME\") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER
```
Log out and back in (`exit`, then SSH again) so the `docker` group applies.

## 7) Start etcd+MinIO on VM2/VM3/VM4
On each of VM2/VM3/VM4:
- Copy file `deploy/azure-4vm/storage-compose.yml` to the VM (or paste it)
- Set environment variables for the node name and IPs
- `docker compose up -d`

Use these files from this repo:
- `deploy/azure-4vm/storage-compose.yml`

## 8) Start backend+frontend on VM1
On VM1:
- Ensure the repo is present on VM1 (clone from GitHub), then run Compose from inside the repo so the `build:` paths work
- Set environment variables for `<VM2_PRIV>`, `<VM3_PRIV>`, `<VM4_PRIV>`
- `docker compose up -d --build`

Use these files from this repo:
- `deploy/azure-4vm/app-compose.yml`

Tip (ProxyJump): you can SSH/SCP to private VMs directly from your PC:
```cmd
ssh -J azureuser@<VM1_PUBLIC> azureuser@<VM2_PRIV>
scp -o ProxyJump=azureuser@<VM1_PUBLIC> deploy/azure-4vm/storage-compose.yml azureuser@<VM2_PRIV>:~/storage-compose.yml
```

## 9) Verify
From your browser:
- `http://<VM1_PUBLIC>` (frontend)

From VM1 shell:
```bash
curl -s http://localhost:5000/api/health
```

---

If you want, tell me the **private IPs** you got for VM2/VM3/VM4 and I’ll generate the exact ready-to-paste env exports per VM (no placeholders).
