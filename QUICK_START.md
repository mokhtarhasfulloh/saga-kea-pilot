# SagaOS Kea Pilot - Quick Start Guide

## 🚀 Installation

### One-Line Install (Recommended)
```bash
curl -fsSL https://raw.githubusercontent.com/BlaineHolmes/saga-kea-pilot/main/install.sh | sudo bash
```

### Manual Install
```bash
# Download the script
wget https://raw.githubusercontent.com/BlaineHolmes/saga-kea-pilot/main/install.sh

# Make it executable
chmod +x install.sh

# Run with sudo
sudo ./install.sh
```

### Install with Force Flag (Low Disk Space)
```bash
# For VMs with less than 20GB available disk space
sudo ./install.sh --force
```

---

## 🌐 Access Your Installation

After installation completes, access SagaOS at:

- **Web Interface:** http://[your-server-ip]
- **API Gateway:** http://[your-server-ip]:3001/api/health
- **Kea Control:** http://[your-server-ip]:8000

**Default Login:** `admin` / `admin`

⚠️ **IMPORTANT:** Change the default password immediately!

---

## 📊 Service Management

### Check Service Status
```bash
# Check all services
sudo systemctl status sagaos-api isc-kea-dhcp4-server isc-kea-ctrl-agent named nginx

# Check individual service
sudo systemctl status sagaos-api
```

### Start/Stop/Restart Services
```bash
# Restart API Gateway
sudo systemctl restart sagaos-api

# Restart Kea DHCP
sudo systemctl restart isc-kea-dhcp4-server isc-kea-ctrl-agent

# Restart all services
sudo systemctl restart sagaos-api isc-kea-dhcp4-server isc-kea-ctrl-agent nginx
```

### View Logs
```bash
# API Gateway logs (live)
sudo journalctl -u sagaos-api -f

# Kea DHCP logs
sudo journalctl -u isc-kea-dhcp4-server -f

# Kea Control Agent logs
sudo journalctl -u isc-kea-ctrl-agent -f

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Enable/Disable Auto-Start
```bash
# Enable auto-start on boot
sudo systemctl enable sagaos-api

# Disable auto-start
sudo systemctl disable sagaos-api
```

---

## 🔧 Configuration Files

### SagaOS Configuration
- **Environment:** `/opt/sagaos/.env`
- **API Gateway:** `/opt/sagaos/backend/api-gateway.js`
- **Frontend:** `/opt/sagaos/dist/`

### Kea DHCP Configuration
- **DHCP4 Server:** `/etc/kea/kea-dhcp4.conf`
- **Control Agent:** `/etc/kea/kea-ctrl-agent.conf`
- **Logs:** `/var/log/kea/`

### BIND9 DNS Configuration
- **Main Config:** `/etc/bind/named.conf`
- **Zones:** `/etc/bind/zones/`
- **Logs:** `/var/log/named/`

### Nginx Configuration
- **SagaOS Site:** `/etc/nginx/sites-available/sagaos`
- **Enabled Sites:** `/etc/nginx/sites-enabled/`
- **Logs:** `/var/log/nginx/`

---

## 🛠️ Common Tasks

### Change Default Password
```bash
# Edit environment file
sudo nano /opt/sagaos/.env

# Update these lines:
DB_PASSWORD=your-new-password
KEA_CA_PASSWORD=your-new-password

# Restart services
sudo systemctl restart sagaos-api
```

### Configure DHCP Subnet
```bash
# Edit Kea DHCP configuration
sudo nano /etc/kea/kea-dhcp4.conf

# Find the subnet4 section and modify:
"subnet4": [
    {
        "subnet": "192.168.1.0/24",
        "pools": [ { "pool": "192.168.1.100 - 192.168.1.200" } ],
        "option-data": [
            {
                "name": "routers",
                "data": "192.168.1.1"
            },
            {
                "name": "domain-name-servers",
                "data": "8.8.8.8, 8.8.4.4"
            }
        ]
    }
]

# Restart Kea DHCP
sudo systemctl restart isc-kea-dhcp4-server
```

### Test Kea Control Agent
```bash
# Get version
curl -X POST http://localhost:8000/ \
  -H "Content-Type: application/json" \
  -d '{"command": "version-get", "service": ["dhcp4"]}'

# Get configuration
curl -X POST http://localhost:8000/ \
  -H "Content-Type: application/json" \
  -d '{"command": "config-get", "service": ["dhcp4"]}'

# Get leases
curl -X POST http://localhost:8000/ \
  -H "Content-Type: application/json" \
  -d '{"command": "lease4-get-all", "service": ["dhcp4"]}'
```

### Rebuild Frontend
```bash
# Navigate to installation directory
cd /opt/sagaos

# Rebuild frontend
sudo -u sagaos npm run build

# Restart Nginx
sudo systemctl reload nginx
```

---

## 🔍 Troubleshooting

### Service Won't Start
```bash
# Check service status
sudo systemctl status sagaos-api

# View detailed logs
sudo journalctl -u sagaos-api -n 50 --no-pager

# Check if port is already in use
sudo netstat -tulpn | grep :3001
```

### Kea Control Agent Returns 400
This is normal for GET requests without parameters. Use POST with JSON commands:
```bash
curl -X POST http://localhost:8000/ \
  -H "Content-Type: application/json" \
  -d '{"command": "version-get", "service": ["dhcp4"]}'
```

### Frontend Not Loading
```bash
# Check if Nginx is running
sudo systemctl status nginx

# Check Nginx configuration
sudo nginx -t

# View Nginx error logs
sudo tail -f /var/log/nginx/error.log

# Verify frontend files exist
ls -la /opt/sagaos/dist/
```

### Database Connection Issues
```bash
# Check PostgreSQL status
sudo systemctl status postgresql

# Test database connection
sudo -u postgres psql -c "SELECT version();"

# Check database exists
sudo -u postgres psql -l | grep kea

# Test with admin user
PGPASSWORD=admin psql -h localhost -U admin -d kea -c "SELECT 1;"
```

### Permission Denied Errors
```bash
# Fix ownership of SagaOS files
sudo chown -R sagaos:sagaos /opt/sagaos

# Fix Kea directory permissions
sudo chmod 755 /etc/kea
sudo chown -R _kea:_kea /var/run/kea /var/log/kea

# Fix environment file permissions
sudo chmod 600 /opt/sagaos/.env
sudo chown sagaos:sagaos /opt/sagaos/.env
```

---

## 📈 Performance Tuning

### Increase PostgreSQL Connections
```bash
# Edit PostgreSQL configuration
sudo nano /etc/postgresql/16/main/postgresql.conf

# Increase max_connections
max_connections = 200

# Restart PostgreSQL
sudo systemctl restart postgresql
```

### Enable Nginx Caching
```bash
# Edit Nginx configuration
sudo nano /etc/nginx/sites-available/sagaos

# Add caching directives
location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf)$ {
    expires 1y;
    add_header Cache-Control "public, immutable";
}

# Reload Nginx
sudo systemctl reload nginx
```

---

## 🔒 Security Hardening

### Enable Firewall
```bash
# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow DHCP
sudo ufw allow 67/udp
sudo ufw allow 68/udp

# Allow DNS
sudo ufw allow 53/tcp
sudo ufw allow 53/udp

# Enable firewall
sudo ufw --force enable
```

### Set Up SSL/TLS (Let's Encrypt)
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d your-domain.com

# Auto-renewal is configured automatically
```

### Restrict Kea Control Agent Access
```bash
# Edit Kea Control Agent config
sudo nano /etc/kea/kea-ctrl-agent.conf

# Change http-host from 0.0.0.0 to 127.0.0.1
"http-host": "127.0.0.1",

# Restart Kea Control Agent
sudo systemctl restart isc-kea-ctrl-agent
```

---

## 📚 Additional Resources

- **Installation Log:** `/tmp/sagaos-install.log`
- **Project Repository:** https://github.com/BlaineHolmes/saga-kea-pilot
- **Kea Documentation:** https://kea.readthedocs.io/
- **BIND9 Documentation:** https://bind9.readthedocs.io/

---

## 🆘 Getting Help

If you encounter issues:

1. Check the installation log: `cat /tmp/sagaos-install.log`
2. Review service logs: `sudo journalctl -u sagaos-api -n 100`
3. Verify all services are running: `sudo systemctl status sagaos-api isc-kea-dhcp4-server isc-kea-ctrl-agent`
4. Check the troubleshooting section above
5. Open an issue on GitHub: https://github.com/BlaineHolmes/saga-kea-pilot/issues

---

**Happy DHCP Management! 🎉**

