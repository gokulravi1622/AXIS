"""Seed Confluence spaces with realistic pages for AXIS demo."""
from dotenv import load_dotenv
load_dotenv('/Users/gokulravi/Desktop/AXIS/.env')

import os, requests
from requests.auth import HTTPBasicAuth

base = os.environ['JIRA_BASE_URL']
auth = HTTPBasicAuth(os.environ['JIRA_EMAIL'], os.environ['JIRA_API_TOKEN'])
headers = {'Content-Type': 'application/json'}

def body(text):
    return {"storage": {"value": f"<p>{text}</p>", "representation": "storage"}}

pages = [
    # Engineering
    {"space": "ENG", "title": "System Architecture Overview",
     "content": "AXIS platform runs on AWS ECS Fargate. Core services: AuthService (port 3001), RewardsService (port 3002), BenefitsService (port 3003), NotificationService (port 3004). All services communicate via SQS queues. PostgreSQL for transactional data, Redis for session cache. Infrastructure managed via Terraform. CI/CD through GitHub Actions, deploys to ECS on merge to main."},
    {"space": "ENG", "title": "Production Deployment Runbook",
     "content": "To deploy to production: 1) Merge PR to main branch — GitHub Actions triggers build. 2) Docker image pushed to ECR. 3) ECS service updated via rolling deployment (min 50% healthy). 4) Monitor CloudWatch dashboard for error rate spike. 5) If error rate exceeds 1%, rollback via ECS console: select service, update to previous task definition revision. Deployment window: Mon-Thu 10am-4pm EST only. Never deploy on Fridays."},
    {"space": "ENG", "title": "On-Call Escalation Guide",
     "content": "P1 (production down): page on-call immediately via PagerDuty, escalate to Engineering lead within 15 min if unresolved. P2 (partial degradation): on-call has 30 min to triage. P3 (non-critical): handle in next business day. On-call rotation: 1-week shifts, Mon-Mon. Handoff notes must be written in this Confluence page every Monday by 9am."},
    {"space": "ENG", "title": "Local Development Setup",
     "content": "Prerequisites: Node.js 20+, Docker Desktop, AWS CLI v2, Vault CLI. Clone the monorepo from internal Git. Run make bootstrap to pull secrets from Vault and start local dependencies via Docker Compose (Postgres, Redis, LocalStack). Use make dev to start all services. Port mapping: AuthService 3001, RewardsService 3002, BenefitsService 3003, NotificationService 3004. Never connect to production from local."},

    # Data
    {"space": "DATA", "title": "Data Pipeline Architecture",
     "content": "All member event data flows through Kafka into S3 (raw layer), then processed by Airflow DAGs into the analytics PostgreSQL database. DAG schedule: member_events_daily runs at 01:00 UTC, member_churn_weekly runs every Monday 03:00 UTC. Spark clusters on EMR for heavy transformations. Dashboard data served from Redshift via Tableau and internal APIs."},
    {"space": "DATA", "title": "SLA Policy — Dashboard Refresh",
     "content": "Enterprise tier: dashboards refresh every 4 hours, SLA 99.5% uptime. Mid-market tier: dashboards refresh every 8 hours, SLA 99% uptime. Starter tier: daily refresh, best-effort. SLA breach process: if Enterprise SLA is breached, notify Client Success within 30 minutes. Post-mortem required for any breach exceeding 2x the SLA window. Compensation: service credits per contract terms."},
    {"space": "DATA", "title": "Data Quality Checks",
     "content": "Automated data quality checks run after every DAG completion. Checks: row count vs previous day (alert if >20% variance), null rate on key fields (member_id, event_type, timestamp), duplicate transaction_ref_id detection. Failures trigger a PagerDuty alert and pause downstream DAGs. Manual override requires Data team lead approval."},

    # CRM
    {"space": "CRM", "title": "Salesforce Data Model",
     "content": "Core objects: Account (company), Contact (individual), Opportunity (deal), Contract (signed agreement). Custom objects: Member_Plan__c (benefit plan details), Renewal_Schedule__c (automated renewal tracking). Key fields: Account.ARR__c (annual recurring revenue), Contract.End_Date__c (used for renewal automation). All CRM data syncs to data warehouse nightly at 00:30 UTC."},
    {"space": "CRM", "title": "Campaign Segmentation Guide",
     "content": "Campaign segments are built in Salesforce using Contact filters. Standard segments: Enterprise Active (ARR > 100k, contract active), At-Risk (no login in 30 days), Renewal Due (contract end within 90 days). Before running any campaign, verify segment count in sandbox first. Campaigns must be approved by Revenue Ops lead. Do not use segments flagged with Dedup_Pending — they may contain merged records under review."},
    {"space": "CRM", "title": "Renewal Process Playbook",
     "content": "90 days before renewal: send intro email, schedule QBR. 60 days: QBR held, expansion opportunity assessed, renewal quote sent. 30 days: follow-up on unsigned quote, escalate to VP Sales if no response. 7 days: final escalation, legal review if needed. Post-renewal: update Contract.End_Date, log in Salesforce, notify CS team. Renewals under $50k: handled by account manager. Over $50k: VP Sales must co-sign."},

    # Client Success
    {"space": "CS", "title": "Client Onboarding Checklist",
     "content": "Week 1: kickoff call, SSO configuration, admin user setup, security review. Week 2: benefits card issuance for all members, integration testing with client HR system. Week 3: custom dashboard configuration, training session for HR admins, UAT sign-off. Week 4: go-live, hypercare period begins (daily check-ins for 2 weeks). Success criteria: all members active, first reward redemption within 30 days."},
    {"space": "CS", "title": "Escalation Handling Policy",
     "content": "T1 (general questions): CS rep responds within 2 business hours. T2 (functional issues affecting users): respond within 4 hours, resolve within 24 hours. T3 (data loss, security, full outage): escalate to Engineering immediately, respond to client within 30 minutes. Client compensation for SLA breach: T2 breach = 5% monthly credit, T3 breach = 15% monthly credit. All T3 escalations require post-mortem shared with client."},
    {"space": "CS", "title": "QBR Template and Guide",
     "content": "Quarterly Business Reviews should cover: 1) Usage metrics — active members, reward redemption rate, login frequency vs benchmark. 2) SLA compliance report — uptime, dashboard refresh SLA. 3) Support ticket summary — volume, resolution time, open items. 4) Roadmap preview — upcoming features relevant to client. 5) Renewal discussion — contract terms, expansion opportunities. Deck must be sent to client 48 hours before the meeting."},

    # Product
    {"space": "PROD", "title": "Product Roadmap H2 2024",
     "content": "Q3 priorities: Digital Card Phase 2 (Apple Wallet, Google Pay, push notifications), Member App v3.2 (navigation fix, performance improvements), HR Admin Bulk Reward Issuance (CSV upload). Q4 priorities: Analytics Dashboard v2 (self-serve filtering for HR admins), SSO improvements (SCIM provisioning support), Mobile App v4.0 (redesign). All Q3 items are committed. Q4 items subject to change based on Q3 learnings."},
    {"space": "PROD", "title": "Feature Spec — Digital Card Phase 2",
     "content": "Digital Card Phase 2 enables members to add their benefits card to Apple Wallet and Google Pay. Features: real-time balance sync (WebSocket), transaction push notifications (FCM/APNs), card freeze/unfreeze from app. Technical dependencies: CardService API v3 (Engineering, ETA August 15), Wallet Service webhook support (Engineering, ETA August 1). Design: completed June 28. Dev start: July 7. QA: August 20. Launch: September 1 target."},
    {"space": "PROD", "title": "Release Process",
     "content": "Feature freeze: 2 weeks before release date. QA sign-off required from at least 2 QA engineers. Release notes must be written by PM and reviewed by CS team (they inform clients). Mobile releases: submitted to App Store and Play Store 1 week before launch date to account for review time. Hotfixes: skip standard freeze, require Engineering lead + PM approval. Post-release: monitor error rates for 48 hours, PM on standby."},
]

created = 0
for p in pages:
    payload = {
        "type": "page",
        "title": p["title"],
        "space": {"key": p["space"]},
        "body": body(p["content"])
    }
    r = requests.post(f'{base}/wiki/rest/api/content', auth=auth, headers=headers, json=payload, timeout=10)
    if r.ok:
        created += 1
        print(f"  created [{p['space']}] {p['title']}")
    else:
        print(f"  FAILED [{p['space']}] {p['title']}: {r.status_code} {r.text[:150]}")

print(f"\n{created}/{len(pages)} pages created in Confluence.")
