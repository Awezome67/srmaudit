import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/**
 * FINAL SEED (Module 1 + Module 2 + Module 4 compliant)
 * - Users: ADMIN + AUDITOR + AUDITEE
 * - Organization + exposure saved
 * - AuditAssignment
 * - Assets (2)
 * - Vulnerabilities (19 required OWASP-based list)
 * - Controls (ISO/IEC 27001 simplified) mapped via Control.mappedVulnName === Vulnerability.name
 *
 * IMPORTANT:
 * - Vulnerability.name MUST match Control.mappedVulnName for auto-checklist mapping.
 */

function computeExposure(sector: string, employees: number, systemType: string) {
  const s = (sector || "").toLowerCase();
  const t = (systemType || "").toLowerCase();

  const systemScore =
    t.includes("cloud") ? 3 :
    t.includes("web") ? 2 :
    t.includes("mobile") ? 2 :
    (t.includes("internal") || t.includes("network")) ? 1 :
    1;

  const employeeScore =
    employees >= 1000 ? 3 :
    employees >= 200 ? 2 :
    1;

  const highRiskSectors = [
    "finance", "bank",
    "health", "hospital",
    "education", "university",
    "government"
  ];
  const sectorScore = highRiskSectors.some((k) => s.includes(k)) ? 2 : 1;

  const score = systemScore + employeeScore + sectorScore;

  const exposureLevel =
    score >= 7 ? "HIGH" :
    score >= 5 ? "MEDIUM" :
    "LOW";

  return { exposureLevel, exposureScore: score };
}

async function main() {
  // =========================
  // 0) USERS (ADMIN/AUDITOR/AUDITEE)
  // =========================
  const adminEmail = "admin@demo.com";
  const auditorEmail = "auditor@demo.com";
  const auditeeEmail = "auditee@demo.com";

  const ADMIN_PASSWORD = "admin123";
  const AUDITOR_PASSWORD = "auditor123";
  const AUDITEE_PASSWORD = "auditee123";

  const adminHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const auditorHash = await bcrypt.hash(AUDITOR_PASSWORD, 10);
  const auditeeHash = await bcrypt.hash(AUDITEE_PASSWORD, 10);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: { name: "Admin", password: adminHash, role: Role.ADMIN },
    create: { name: "Admin", email: adminEmail, password: adminHash, role: Role.ADMIN },
  });

  const auditor = await prisma.user.upsert({
    where: { email: auditorEmail },
    update: { name: "Auditor Demo", password: auditorHash, role: Role.AUDITOR },
    create: { name: "Auditor Demo", email: auditorEmail, password: auditorHash, role: Role.AUDITOR },
  });

  const auditee = await prisma.user.upsert({
    where: { email: auditeeEmail },
    update: { name: "Auditee Demo", password: auditeeHash, role: Role.AUDITEE },
    create: { name: "Auditee Demo", email: auditeeEmail, password: auditeeHash, role: Role.AUDITEE },
  });

  // =========================
  // 1) ORGANIZATION (with exposure saved)
  // =========================
  const orgName = "Demo Organization";
  const orgSector = "Education";
  const orgEmployees = 200;
  const orgSystemType = "Web";

  const exp = computeExposure(orgSector, orgEmployees, orgSystemType);

  // upsert by name (lebih stabil daripada coba set id fix)
  const existingOrg = await prisma.organization.findFirst({ where: { name: orgName } });
  const org = existingOrg
    ? await prisma.organization.update({
        where: { id: existingOrg.id },
        data: {
          sector: orgSector,
          employees: orgEmployees,
          systemType: orgSystemType,
          exposureLevel: exp.exposureLevel,
          exposureScore: exp.exposureScore,
        },
      })
    : await prisma.organization.create({
        data: {
          name: orgName,
          sector: orgSector,
          employees: orgEmployees,
          systemType: orgSystemType,
          exposureLevel: exp.exposureLevel,
          exposureScore: exp.exposureScore,
        },
      });

  // =========================
  // 2) AUDIT ASSIGNMENT (AUDITOR -> ORG)
  // =========================
  await prisma.auditAssignment.upsert({
    where: { organizationId_auditorId: { organizationId: org.id, auditorId: auditor.id } },
    update: {},
    create: { organizationId: org.id, auditorId: auditor.id },
  });

  // =========================
  // 3) ASSETS (2 demo assets)
  // =========================
  const assetsData = [
    {
      name: "Student Portal",
      owner: "IT Department",
      location: "Cloud Server",
      type: "Application",
      cia: "Medium",
    },
    {
      name: "Finance DB",
      owner: "Finance Team",
      location: "On-Prem",
      type: "Data",
      cia: "High",
    },
  ];

  for (const a of assetsData) {
    const exist = await prisma.asset.findFirst({
      where: { organizationId: org.id, name: a.name },
    });

    if (!exist) {
      await prisma.asset.create({
        data: {
          organizationId: org.id,
          ...a,
        },
      });
    }
  }

  // =========================
  // 4) VULNERABILITIES (19 required list)
  // Names aligned with the requirement doc.
  // =========================
  const vulnerabilities = [
    // Injection (3)
    { name: "SQL Injection", category: "Injection", defaultLike: 4, defaultImp: 5 },
    { name: "Command Injection", category: "Injection", defaultLike: 4, defaultImp: 5 },
    { name: "LDAP Injection", category: "Injection", defaultLike: 3, defaultImp: 4 },

    // Broken Authentication (3)
    { name: "Weak Password Policy", category: "Broken Authentication", defaultLike: 4, defaultImp: 4 },
    { name: "No Account Lockout", category: "Broken Authentication", defaultLike: 3, defaultImp: 4 },
    { name: "Session Hijacking", category: "Broken Authentication", defaultLike: 3, defaultImp: 5 },

    // Sensitive Data Exposure (3)
    { name: "No HTTPS / TLS", category: "Sensitive Data Exposure", defaultLike: 4, defaultImp: 5 },
    { name: "Weak Encryption", category: "Sensitive Data Exposure", defaultLike: 3, defaultImp: 5 },
    { name: "Exposed Database Backup", category: "Sensitive Data Exposure", defaultLike: 2, defaultImp: 5 },

    // Access Control Failures (2)
    { name: "IDOR (Insecure Direct Object Reference)", category: "Access Control Failures", defaultLike: 3, defaultImp: 4 },
    { name: "Privilege Escalation", category: "Access Control Failures", defaultLike: 3, defaultImp: 5 },

    // Security Misconfiguration (4)
    { name: "Default Credentials", category: "Security Misconfiguration", defaultLike: 4, defaultImp: 5 },
    { name: "Directory Listing Enabled", category: "Security Misconfiguration", defaultLike: 3, defaultImp: 3 },
    { name: "Exposed Admin Panel", category: "Security Misconfiguration", defaultLike: 3, defaultImp: 4 },
    { name: "Open Unnecessary Ports", category: "Security Misconfiguration", defaultLike: 3, defaultImp: 4 },

    // Cross-Site Attacks (2)
    { name: "Cross-Site Scripting (XSS)", category: "Cross-Site Attacks", defaultLike: 4, defaultImp: 4 },
    { name: "Cross-Site Request Forgery (CSRF)", category: "Cross-Site Attacks", defaultLike: 3, defaultImp: 4 },

    // Logging & Monitoring Failure (1)
    { name: "No Audit Logs", category: "Logging & Monitoring Failure", defaultLike: 2, defaultImp: 4 },

    // Dependency & Software Issues (1)
    { name: "Outdated Server Software", category: "Dependency & Software Issues", defaultLike: 3, defaultImp: 5 },
  ];

  for (const v of vulnerabilities) {
    await prisma.vulnerability.upsert({
      where: { name: v.name },
      update: {
        category: v.category,
        defaultLike: v.defaultLike,
        defaultImp: v.defaultImp,
      },
      create: v,
    });
  }

  // =========================
  // 5) CONTROLS (ISO/IEC 27001 simplified)
  // Mapped by vuln name
  // =========================
  const controls = [
    // Weak Password Policy
    {
      framework: "ISO/IEC 27001",
      name: "Password policy enforced (min length, complexity, lockout)",
      mappedVulnName: "Weak Password Policy",
    },
    {
      framework: "ISO/IEC 27001",
      name: "MFA enabled for privileged/admin accounts",
      mappedVulnName: "Weak Password Policy",
    },

    // No Account Lockout
    {
      framework: "ISO/IEC 27001",
      name: "Account lockout after repeated failed logins",
      mappedVulnName: "No Account Lockout",
    },

    // Session Hijacking
    {
      framework: "ISO/IEC 27001",
      name: "Secure session management (timeout, regeneration, secure cookies)",
      mappedVulnName: "Session Hijacking",
    },

    // No HTTPS / TLS
    {
      framework: "ISO/IEC 27001",
      name: "TLS certificate configured and HTTPS enforced",
      mappedVulnName: "No HTTPS / TLS",
    },
    {
      framework: "ISO/IEC 27001",
      name: "Secure transport configuration reviewed (TLS versions/ciphers)",
      mappedVulnName: "No HTTPS / TLS",
    },

    // Weak Encryption
    {
      framework: "ISO/IEC 27001",
      name: "Encryption standards defined for data at rest and in transit",
      mappedVulnName: "Weak Encryption",
    },

    // Exposed Database Backup
    {
      framework: "ISO/IEC 27001",
      name: "Backups protected (access control, encryption) and not publicly exposed",
      mappedVulnName: "Exposed Database Backup",
    },

    // No Audit Logs
    {
      framework: "ISO/IEC 27001",
      name: "Audit logging enabled for key events (auth, admin actions, data access)",
      mappedVulnName: "No Audit Logs",
    },
    {
      framework: "ISO/IEC 27001",
      name: "Log retention & monitoring procedure implemented",
      mappedVulnName: "No Audit Logs",
    },

    // Outdated Server Software
    {
      framework: "ISO/IEC 27001",
      name: "Patch management process defined and followed",
      mappedVulnName: "Outdated Server Software",
    },
    {
      framework: "ISO/IEC 27001",
      name: "Asset/software inventory maintained for updates",
      mappedVulnName: "Outdated Server Software",
    },

    // Open Unnecessary Ports
    {
      framework: "ISO/IEC 27001",
      name: "Firewall rules reviewed; only required ports exposed",
      mappedVulnName: "Open Unnecessary Ports",
    },
    {
      framework: "ISO/IEC 27001",
      name: "Network segmentation and access restrictions applied",
      mappedVulnName: "Open Unnecessary Ports",
    },

    // Exposed Admin Panel
    {
      framework: "ISO/IEC 27001",
      name: "Admin interface access restricted (IP allowlist/VPN)",
      mappedVulnName: "Exposed Admin Panel",
    },

    // Default Credentials
    {
      framework: "ISO/IEC 27001",
      name: "Default credentials removed; credentials vault used",
      mappedVulnName: "Default Credentials",
    },

    // Directory Listing Enabled
    {
      framework: "ISO/IEC 27001",
      name: "Server hardening (directory listing disabled; least functionality)",
      mappedVulnName: "Directory Listing Enabled",
    },

    // IDOR
    {
      framework: "ISO/IEC 27001",
      name: "Access control checks enforced on object/resource level (IDOR)",
      mappedVulnName: "IDOR (Insecure Direct Object Reference)",
    },

    // Privilege Escalation
    {
      framework: "ISO/IEC 27001",
      name: "Privileged access rights reviewed and minimized (least privilege)",
      mappedVulnName: "Privilege Escalation",
    },

    // SQL Injection
    {
      framework: "ISO/IEC 27001",
      name: "Input validation and parameterized queries implemented (SQLi)",
      mappedVulnName: "SQL Injection",
    },

    // Command Injection
    {
      framework: "ISO/IEC 27001",
      name: "Command execution disabled/restricted; input validation for OS calls",
      mappedVulnName: "Command Injection",
    },

    // LDAP Injection
    {
      framework: "ISO/IEC 27001",
      name: "LDAP query parameterization and validation implemented",
      mappedVulnName: "LDAP Injection",
    },

    // XSS
    {
      framework: "ISO/IEC 27001",
      name: "Output encoding & sanitization implemented (XSS)",
      mappedVulnName: "Cross-Site Scripting (XSS)",
    },
    {
      framework: "ISO/IEC 27001",
      name: "Content Security Policy (CSP) configured",
      mappedVulnName: "Cross-Site Scripting (XSS)",
    },

    // CSRF
    {
      framework: "ISO/IEC 27001",
      name: "CSRF tokens implemented for state-changing actions",
      mappedVulnName: "Cross-Site Request Forgery (CSRF)",
    },
    {
      framework: "ISO/IEC 27001",
      name: "SameSite cookies & origin checks configured",
      mappedVulnName: "Cross-Site Request Forgery (CSRF)",
    },
  ];

  for (const c of controls) {
    const exist = await prisma.control.findFirst({
      where: {
        framework: c.framework,
        name: c.name,
        mappedVulnName: c.mappedVulnName,
      },
    });

    if (!exist) {
      await prisma.control.create({ data: c });
    }
  }

  console.log("✅ FINAL SEED DONE");
  console.log("---- DEMO CREDENTIALS ----");
  console.log("ADMIN  :", adminEmail, " / ", ADMIN_PASSWORD);
  console.log("AUDITOR:", auditorEmail, " / ", AUDITOR_PASSWORD);
  console.log("AUDITEE:", auditeeEmail, " / ", AUDITEE_PASSWORD);
  console.log("--------------------------");
  console.log("Org:", org.name, "(", org.id, ")", "Exposure:", org.exposureLevel, org.exposureScore);
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });