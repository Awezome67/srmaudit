import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * IMPORTANT:
 * - Vulnerability.name harus EXACT match dengan Control.mappedVulnName
 *   supaya auto-generate checklist kamu nyala.
 */

async function main() {
  // 1) Seed Vulnerabilities (OWASP + common infra)
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
      update: { category: v.category, defaultLike: v.defaultLike, defaultImp: v.defaultImp },
      create: v,
    });
  }

  // 2) Seed Controls (subset ISO/IEC 27001:2022-style, simplified)
  // NOTE: schema kamu "Control" cuma punya framework + name + mappedVulnName
  // Jadi kita seed "name" sebagai kontrol audit checklist yang dibutuhkan.
  const controls = [
    // Weak Password Policy
    { framework: "ISO/IEC 27001", name: "Password policy enforced (min length, complexity, lockout)", mappedVulnName: "Weak Password Policy" },
    { framework: "ISO/IEC 27001", name: "MFA enabled for privileged/admin accounts", mappedVulnName: "Weak Password Policy" },

    // No HTTPS/TLS
    { framework: "ISO/IEC 27001", name: "TLS certificate configured and HTTPS enforced", mappedVulnName: "No HTTPS/TLS" },
    { framework: "ISO/IEC 27001", name: "Secure transport configuration reviewed (TLS versions/ciphers)", mappedVulnName: "No HTTPS/TLS" },

    // No Audit Logs
    { framework: "ISO/IEC 27001", name: "Audit logging enabled for key events (auth, admin actions, data access)", mappedVulnName: "No Audit Logs" },
    { framework: "ISO/IEC 27001", name: "Log retention & monitoring procedure implemented", mappedVulnName: "No Audit Logs" },

    // Outdated Server Software
    { framework: "ISO/IEC 27001", name: "Patch management process defined and followed", mappedVulnName: "Outdated Server Software" },
    { framework: "ISO/IEC 27001", name: "Asset/software inventory maintained for updates", mappedVulnName: "Outdated Server Software" },

    // Open Unnecessary Ports
    { framework: "ISO/IEC 27001", name: "Firewall rules reviewed; only required ports exposed", mappedVulnName: "Open Unnecessary Ports" },
    { framework: "ISO/IEC 27001", name: "Network segmentation and access restrictions applied", mappedVulnName: "Open Unnecessary Ports" },

    // Exposed Admin Panel
    { framework: "ISO/IEC 27001", name: "Admin interface access restricted (IP allowlist/VPN)", mappedVulnName: "Exposed Admin Panel" },
    { framework: "ISO/IEC 27001", name: "Privileged access rights reviewed and minimized", mappedVulnName: "Exposed Admin Panel" },

    // OWASP: SQLi
    { framework: "ISO/IEC 27001", name: "Input validation and parameterized queries implemented", mappedVulnName: "SQL Injection" },
    { framework: "ISO/IEC 27001", name: "Secure coding review and testing performed (SQLi)", mappedVulnName: "SQL Injection" },

    // OWASP: XSS
    { framework: "ISO/IEC 27001", name: "Output encoding & sanitization implemented (XSS)", mappedVulnName: "Cross-Site Scripting (XSS)" },
    { framework: "ISO/IEC 27001", name: "Content Security Policy (CSP) configured", mappedVulnName: "Cross-Site Scripting (XSS)" },

    // OWASP: CSRF
    { framework: "ISO/IEC 27001", name: "CSRF tokens implemented for state-changing actions", mappedVulnName: "Cross-Site Request Forgery (CSRF)" },
    { framework: "ISO/IEC 27001", name: "SameSite cookies & origin checks configured", mappedVulnName: "Cross-Site Request Forgery (CSRF)" },

    // Insecure File Upload
    { framework: "ISO/IEC 27001", name: "File upload validation (type/size) and malware scan", mappedVulnName: "Insecure File Upload" },
    { framework: "ISO/IEC 27001", name: "Upload storage isolation and access control enforced", mappedVulnName: "Insecure File Upload" },
  ];

  for (const c of controls) {
    // "name" tidak unique di schema kamu, jadi pakai combo framework+name+mappedVulnName
    // Kita cari manual dulu supaya tidak duplicate.
    const exist = await prisma.control.findFirst({
      where: { framework: c.framework, name: c.name, mappedVulnName: c.mappedVulnName },
    });

    if (!exist) {
      await prisma.control.create({ data: c });
    }
  }

  console.log("✅ Seed completed: vulnerabilities + controls inserted/updated.");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });