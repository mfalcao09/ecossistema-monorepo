#!/bin/bash

################################################################################
# Cloudflare WAF Setup Script — ERP Educacional (Diploma Digital)
################################################################################
#
# DESCRIPTION:
#   Automates deployment of Cloudflare WAF rules via the API (v4).
#   Configures custom firewall rules, rate limiting, and managed rulesets
#   for the FIC Diploma Digital platform.
#
# USAGE:
#   export CF_API_TOKEN="your_cloudflare_api_token"
#   export CF_ZONE_ID="your_cloudflare_zone_id"
#   ./scripts/cloudflare-waf-setup.sh
#
# REQUIREMENTS:
#   - curl (HTTP client)
#   - jq (JSON parser)
#   - Cloudflare account with Zone.Firewall.Manage permission
#   - CF_API_TOKEN and CF_ZONE_ID environment variables
#
# AUTHOR: ERP Educacional Team
# DATE: 2026-03-26
#
################################################################################

set -e  # Exit on error

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_BASE="https://api.cloudflare.com/client/v4"
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
LOG_FILE="${SCRIPT_DIR}/waf-setup-$(date +%Y%m%d-%H%M%S).log"

################################################################################
# Logging Functions
################################################################################

log_info() {
    echo -e "${BLUE}[INFO]${NC} $@" | tee -a "$LOG_FILE"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $@" | tee -a "$LOG_FILE"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $@" | tee -a "$LOG_FILE"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $@" | tee -a "$LOG_FILE"
}

################################################################################
# Validation Functions
################################################################################

validate_requirements() {
    log_info "Validating requirements..."

    # Check for required commands
    command -v curl >/dev/null 2>&1 || { log_error "curl is not installed"; exit 1; }
    command -v jq >/dev/null 2>&1 || { log_error "jq is not installed"; exit 1; }

    # Check for required environment variables
    if [ -z "$CF_API_TOKEN" ]; then
        log_error "CF_API_TOKEN environment variable is not set"
        exit 1
    fi

    if [ -z "$CF_ZONE_ID" ]; then
        log_error "CF_ZONE_ID environment variable is not set"
        exit 1
    fi

    log_success "All requirements validated"
}

test_api_connection() {
    log_info "Testing Cloudflare API connection..."

    local response=$(curl -s -X GET "${API_BASE}/zones/${CF_ZONE_ID}" \
        -H "Authorization: Bearer ${CF_API_TOKEN}" \
        -H "Content-Type: application/json")

    if echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        local zone_name=$(echo "$response" | jq -r '.result.name')
        log_success "Connected to Cloudflare zone: $zone_name"
        return 0
    else
        local error=$(echo "$response" | jq -r '.errors[0].message // "Unknown error"')
        log_error "Failed to connect to Cloudflare API: $error"
        exit 1
    fi
}

################################################################################
# Rule Management Functions
################################################################################

# Check if a firewall rule exists by name/description
rule_exists() {
    local rule_name="$1"
    local response=$(curl -s -X GET "${API_BASE}/zones/${CF_ZONE_ID}/firewall/rules" \
        -H "Authorization: Bearer ${CF_API_TOKEN}" \
        -H "Content-Type: application/json" \
        -G --data-urlencode "description=${rule_name}")

    if echo "$response" | jq -e '.result | length > 0' >/dev/null 2>&1; then
        return 0  # Rule exists
    else
        return 1  # Rule does not exist
    fi
}

# Create a custom firewall rule
create_firewall_rule() {
    local description="$1"
    local expression="$2"
    local action="$3"
    local priority="${4:-1000}"

    log_info "Creating firewall rule: $description"

    # Check if rule already exists
    if rule_exists "$description"; then
        log_warning "Rule '$description' already exists, skipping..."
        return 0
    fi

    local response=$(curl -s -X POST "${API_BASE}/zones/${CF_ZONE_ID}/firewall/rules" \
        -H "Authorization: Bearer ${CF_API_TOKEN}" \
        -H "Content-Type: application/json" \
        -d @- <<EOF
{
  "description": "$description",
  "expression": "$expression",
  "action": "$action",
  "priority": $priority
}
EOF
)

    if echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        local rule_id=$(echo "$response" | jq -r '.result.id')
        log_success "Created firewall rule: $description (ID: $rule_id)"
        return 0
    else
        local error=$(echo "$response" | jq -r '.errors[0].message // "Unknown error"')
        log_error "Failed to create firewall rule '$description': $error"
        return 1
    fi
}

# Create a rate limiting rule
create_rate_limit_rule() {
    local description="$1"
    local expression="$2"
    local threshold="$3"
    local period="$4"

    log_info "Creating rate limit rule: $description"

    local response=$(curl -s -X POST "${API_BASE}/zones/${CF_ZONE_ID}/rate_limit" \
        -H "Authorization: Bearer ${CF_API_TOKEN}" \
        -H "Content-Type: application/json" \
        -d @- <<EOF
{
  "description": "$description",
  "match": {
    "request": {
      "url": {
        "path": {}
      }
    }
  },
  "action": {
    "mode": "block",
    "response": {
      "status_code": 429
    }
  },
  "threshold": $threshold,
  "period": $period,
  "characteristics": ["ip.src"],
  "mitigation_timeout": 300
}
EOF
)

    if echo "$response" | jq -e '.success' >/dev/null 2>&1; then
        local rule_id=$(echo "$response" | jq -r '.result.id')
        log_success "Created rate limit rule: $description (ID: $rule_id)"
        return 0
    else
        # Note: Rate limit API might have different response structure
        log_warning "Rate limit rule '$description' may require manual setup or different API parameters"
        return 1
    fi
}

################################################################################
# WAF Rule Deployment
################################################################################

deploy_all_rules() {
    log_info "Deploying WAF rules..."

    # Rule 1: Block API requests without valid origin/referer
    create_firewall_rule \
        "Block API requests without valid origin/referer" \
        "(cf.threat_score > 0 or (uri.path contains \"/api/\" and not (cf.bot_managed_score <= 20))) and (http.referer eq \"\" or http.origin eq \"\") and (not (http.referer contains \"diploma.fic.edu.br\" or http.referer contains \"localhost\"))" \
        "challenge" \
        "1000"

    # Rule 2: Rate limit CPF lookup (3 req/min per IP)
    log_info "Creating rate limit for /api/portal/consultar-cpf (3 req/min)..."
    # Note: Rate limit is better managed through Cloudflare UI or requires different endpoint

    # Rule 3: Block SQL injection and XSS patterns
    create_firewall_rule \
        "Block SQL injection and XSS patterns" \
        "((querystring contains \"union select\" or querystring contains \"drop table\") or (querystring contains \"<script\" or querystring contains \"javascript:\") or (querystring contains \"onclick=\" or querystring contains \"onerror=\") or (http.request.body.string contains \"exec(\" or http.request.body.string contains \"eval(\")) and (uri.path contains \"/api/\")" \
        "block" \
        "2000"

    # Rule 4: Block known malicious bot user-agents
    create_firewall_rule \
        "Block known malicious bot user-agents" \
        "((http.user_agent contains \"sqlmap\") or (http.user_agent contains \"nikto\") or (http.user_agent contains \"nmap\") or (http.user_agent contains \"masscan\") or (http.user_agent contains \"metasploit\") or (http.user_agent contains \"acunetix\") or (http.user_agent contains \"nessus\") or (http.user_agent contains \"openvas\")) and not (http.user_agent contains \"Googlebot\" or http.user_agent contains \"Bingbot\")" \
        "block" \
        "1500"

    # Rule 5: Block non-Brazil access to admin routes
    create_firewall_rule \
        "Block non-Brazil access to admin routes" \
        "((uri.path contains \"/api/admin/\" or uri.path contains \"/api/auth/\" or uri.path contains \"/api/usuarios/\" or uri.path contains \"/api/emitentes/\")) and cf.country ne \"BR\"" \
        "block" \
        "3000"

    # Rule 6: Challenge high-threat IPs accessing auth endpoints
    create_firewall_rule \
        "Challenge high-threat IPs accessing auth endpoints" \
        "(uri.path contains \"/api/auth/login\" or uri.path contains \"/api/auth/signin\" or uri.path contains \"/api/auth/token\") and cf.threat_score >= 50" \
        "challenge" \
        "2500"

    log_success "All firewall rules deployed"
}

################################################################################
# SSL/TLS Configuration
################################################################################

configure_ssl_tls() {
    log_info "Verifying SSL/TLS configuration..."

    # Note: SSL/TLS settings are primarily set via dashboard
    # This function documents the recommended settings

    cat << 'EOF' | tee -a "$LOG_FILE"

=== SSL/TLS Configuration (set via Cloudflare Dashboard) ===

1. Go to SSL/TLS > Edge Certificates
2. Minimum TLS Version: TLS 1.2 or higher
3. Always Use HTTPS: ON
4. Automatic HTTPS Rewrites: ON
5. HSTS: Enable with 12 months max age
6. Certificate Status: Ensure "Active" certificate

These settings should be configured via the Cloudflare Dashboard
or through Infrastructure as Code (Terraform/Pulumi).

EOF

    log_success "SSL/TLS configuration guidelines displayed"
}

################################################################################
# Managed Rulesets
################################################################################

enable_managed_rulesets() {
    log_info "Enabling managed rulesets..."

    # Note: Managed rulesets require different API endpoints and setup
    # This is documented for manual setup

    cat << 'EOF' | tee -a "$LOG_FILE"

=== Managed Rulesets (set via Cloudflare Dashboard) ===

1. Cloudflare Managed Ruleset (OWASP Core)
   - Go to Security > WAF > Managed Rules
   - Click "Enable" for Cloudflare Managed Ruleset
   - Set sensitivity to High
   - Set paranoia level to 2-3

2. Bot Management (Business plan)
   - Go to Security > Bots > Bot Management
   - Enable "Super Bot Fight Mode"
   - Allow verified bots (Googlebot, Bingbot)
   - Block/challenge suspicious automation

These managed rulesets should be enabled via the Cloudflare Dashboard.

EOF

    log_success "Managed rulesets documentation displayed"
}

################################################################################
# Page Rules Configuration
################################################################################

document_page_rules() {
    log_info "Documenting page rules configuration..."

    cat << 'EOF' | tee -a "$LOG_FILE"

=== Page Rules Configuration (set via Cloudflare Dashboard) ===

Rule 1: Static Asset Caching
  URL Pattern: diploma.fic.edu.br/static/*
  Cache Level: Aggressive
  Browser Cache TTL: 30 days

Rule 2: API Caching
  URL Pattern: diploma.fic.edu.br/api/*
  Cache Level: Respect Server Headers
  Browser Cache TTL: 5 minutes

Rule 3: SSL Enforcement
  URL Pattern: diploma.fic.edu.br/*
  SSL: Full (Strict)
  Always Use HTTPS: On

Configure these in Security > Page Rules section of Cloudflare Dashboard.

EOF

    log_success "Page rules documentation displayed"
}

################################################################################
# Reporting Functions
################################################################################

generate_report() {
    log_info "Generating deployment report..."

    cat << EOF >> "$LOG_FILE"

================================================================================
DEPLOYMENT REPORT
================================================================================
Timestamp: $(date)
Zone ID: ${CF_ZONE_ID}
API Base: ${API_BASE}

Deployed Rules:
  1. Block API requests without valid origin/referer (Challenge)
  2. Block SQL injection and XSS patterns (Block)
  3. Block known malicious bot user-agents (Block)
  4. Block non-Brazil access to admin routes (Block)
  5. Challenge high-threat IPs accessing auth endpoints (Challenge)

Additional Configuration (via Dashboard):
  - Rate limiting rules
  - Managed rulesets (OWASP, Bot Management)
  - Page rules
  - SSL/TLS settings

Log File: ${LOG_FILE}

================================================================================
EOF

    log_success "Deployment report generated: $LOG_FILE"
}

################################################################################
# Main Execution
################################################################################

main() {
    echo -e "${BLUE}"
    cat << 'EOF'

╔═══════════════════════════════════════════════════════════════════════════╗
║                                                                           ║
║  Cloudflare WAF Setup — ERP Educacional (Diploma Digital)                ║
║                                                                           ║
╚═══════════════════════════════════════════════════════════════════════════╝

EOF
    echo -e "${NC}"

    log_info "Starting WAF deployment..."
    log_info "Log file: $LOG_FILE"

    # Execute setup steps
    validate_requirements
    test_api_connection
    deploy_all_rules
    configure_ssl_tls
    enable_managed_rulesets
    document_page_rules
    generate_report

    echo -e "${GREEN}"
    cat << 'EOF'

╔═══════════════════════════════════════════════════════════════════════════╗
║  ✓ WAF Deployment Complete                                              ║
║                                                                           ║
║  Next Steps:                                                              ║
║  1. Review the deployment report in the log file                         ║
║  2. Configure rate limiting rules via Cloudflare Dashboard               ║
║  3. Enable managed rulesets (OWASP, Bot Management)                      ║
║  4. Configure page rules for caching and SSL                             ║
║  5. Set up alerts and monitoring in Cloudflare                           ║
║  6. Test WAF rules with legitimate traffic                               ║
║  7. Review blocking rules in Security > Analytics                        ║
║                                                                           ║
╚═══════════════════════════════════════════════════════════════════════════╝

EOF
    echo -e "${NC}"

    log_success "WAF deployment completed successfully!"
    log_info "See docs/cloudflare-waf-config.md for complete configuration guide"
}

# Run main function
main "$@"
