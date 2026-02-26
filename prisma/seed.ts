import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

/**
 * FINAL SEED (Module 1 + Module 2 ready)
 * - Users: ADMIN + AUDITOR + AUDITEE
 * - Organization + AuditAssignment
 * - Assets (2)
 * - Vulnerabilities + Controls (for auto-checklist)
 *
 * IMPORTANT:
 * - Vulnerability.name MUST match Control.mappedVulnName for auto-checklist mapping.
 */

async function main() {
  // =========================
  // 0) USERS (ADMIN/AUDITOR/AUDITEE)
  // =========================
  const adminEmail = "admin@demo.com";
  const auditorEmail = "auditor@demo.com";
  const auditeeEmail = "auditee@demo.com";

  // Password demo (biar ga bingung)
  const ADMIN_PASSWORD = "admin123";
  const AUDITOR_PASSWORD = "auditor123";
  const AUDITEE_PASSWORD = "auditee123";

  const adminHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const auditorHash = await bcrypt.hash(AUDITOR_PASSWORD, 10);
  const auditeeHash = await bcrypt.hash(AUDITEE_PASSWORD, 10);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: "Admin",
      password: adminHash,
      role: Role.ADMIN,
    },
    create: {
      name: "Admin",
      email: adminEmail,
      password: adminHash,
      role: Role.ADMIN,
    },
  });

  const auditor = await prisma.user.upsert({
    where: { email: auditorEmail },
    update: {
      name: "Auditor Demo",
      password: auditorHash,
      role: Role.AUDITOR,
    },
    create: {
      name: "Auditor Demo",
      email: auditorEmail,
      password: auditorHash,
      role: Role.AUDITOR,
    },
  });

  const auditee = await prisma.user.upsert({
    where: { email: auditeeEmail },
    update: {
      name: "Auditee Demo",
      password: auditeeHash,
      role: Role.AUDITEE,
    },
    create: {
      name: "Auditee Demo",
      email: auditeeEmail,
      password: auditeeHash,
      role: Role.AUDITEE,
    },
  });

  // =========================
  // 1) ORGANIZATION
  // =========================
  const orgName = "Demo Organization";
  const org = await prisma.organization.upsert({
    where: { id: "demo-org-id" }, // trik: kita bikin id fix via upsert? ga bisa kalau id default cuid
    update: {},
    create: {
      name: orgName,
      sector: "Education",
      employees: 200,
      systemType: "Web",
    },
  }).catch(async () => {
    // fallback: kalau upsert id custom gagal (karena schema default cuid), cari by name lalu create
    const exist = await prisma.organization.findFirst({ where: { name: orgName } });
    if (exist) return exist;

    return prisma.organization.create({
      data: {
        name: orgName,
        sector: "Education",
        employees: 200,
        systemType: "Web",
      },
    });
  });

  // =========================
  // 2) AUDIT ASSIGNMENT (AUDITOR -> ORG)
  // =========================
  await prisma.auditAssignment.upsert({
    where: { organizationId_auditorId: { organizationId: org.id, auditorId: auditor.id } },
    update: {},
    create: {
      organizationId: org.id,
      auditorId: auditor.id,
    },
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
  // 4) VULNERABILITIES
  // =========================
  const vulnerabilities = [
    { name: "SQL Injection", category: "OWASP", defaultLike: 4, defaultImp: 5 },
    { name: "Cross-Site Scripting (XSS)", category: "OWASP", defaultLike: 4, defaultImp: 4 },
    { name: "Cross-Site Request Forgery (CSRF)", category: "OWASP", defaultLike: 3, defaultImp: 4 },
    { name: "Weak Password Policy", category: "Authentication", defaultLike: 4, defaultImp: 4 },
    { name: "No HTTPS/TLS", category: "Transport Security", defaultLike: 3, defaultImp: 5 },
    { name: "No Audit Logs", category: "Logging", defaultLike: 3, defaultImp: 4 },
    { name: "Outdated Server Software", category: "Patch Management", defaultLike: 4, defaultImp: 4 },
    { name: "Open Unnecessary Ports", category: "Network Security", defaultLike: 3, defaultImp: 4 },
    { name: "Exposed Admin Panel", category: "Access Control", defaultLike: 4, defaultImp: 4 },
    { name: "Insecure File Upload", category: "OWASP", defaultLike: 3, defaultImp: 4 },
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

    // No HTTPS/TLS
    {
      framework: "ISO/IEC 27001",
      name: "TLS certificate configured and HTTPS enforced",
      mappedVulnName: "No HTTPS/TLS",
    },
    {
      framework: "ISO/IEC 27001",
      name: "Secure transport configuration reviewed (TLS versions/ciphers)",
      mappedVulnName: "No HTTPS/TLS",
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
    {
      framework: "ISO/IEC 27001",
      name: "Privileged access rights reviewed and minimized",
      mappedVulnName: "Exposed Admin Panel",
    },

    // OWASP: SQLi
    {
      framework: "ISO/IEC 27001",
      name: "Input validation and parameterized queries implemented",
      mappedVulnName: "SQL Injection",
    },
    {
      framework: "ISO/IEC 27001",
      name: "Secure coding review and testing performed (SQLi)",
      mappedVulnName: "SQL Injection",
    },

    // OWASP: XSS
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

    // OWASP: CSRF
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

    // Insecure File Upload
    {
      framework: "ISO/IEC 27001",
      name: "File upload validation (type/size) and malware scan",
      mappedVulnName: "Insecure File Upload",
    },
    {
      framework: "ISO/IEC 27001",
      name: "Upload storage isolation and access control enforced",
      mappedVulnName: "Insecure File Upload",
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
  console.log("Org:", org.name, "(", org.id, ")");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });