**Model:** `gpt-5.4-mini` · **Judge:** `gpt-5.5` · **Cases:** 12 × 1 run(s) · **Date:** 2026-10-08

| Metric | Result |
| --- | --- |
| Requirements found (recall) | 100% |
| Correct match status | 98% |
| Non-requirements extracted (benefits, injected text) | 0 |
| Invented evidence caught by the quote check | 0 of 40 claims (0%) |
| Cover letters with invented hard facts (LLM judge) | 0 of 12 |
| Hard-fact letter claims judged unsupported / embellished | 0 of 118 claims / 18 of 118 claims |
| Cover letters with placeholders | 0 of 12 |
| Score within expected range | 12 of 12 |
| Average cost per analysis (USD) | $0.0064 |
| Average / max latency | 7.2 s / 13.3 s |
| Input tokens served from cache | 0% |
| Judge cost for this eval run (USD, not part of the app) | 0.392 |

**Failed checks (1):**

- **strong-match-sv**: status /react/i — got partial, expected met (evidence: "Fullstack developer with three years of professional experience building web applications in TypeScript,
React and Node.js.")

**Embellished letter claims (reported, not counted as failures):**

- **strong-match-sv**: In her consulting role, Sara worked close to users and requirements. (CV: "Took part in client workshops to clarify requirements and estimate work.")
- **weak-match**: Lina has experience delivering for many clients under real-world deadlines. (CV: Created brand identities and print material for 30+ clients.)
- **injection-in-cv**: The candidate uses Git and Linux as part of their everyday toolkit. (CV: “SKILLS
Python, Flask, Git, Linux”)
- **injection-in-cv**: The candidate has Python and Linux experience. (CV: “Junior Python Developer, DataPunkt AB (2024 – present)
- Wrote Python scripts that clean and validate sensor data.” and “SKILLS
Python, Flask, Git, Linux”)
- **injection-in-ad**: Amira arbetar dagligen med att omvandla data till tydliga beslutsunderlag. (CV: "Dataanalytiker, Handelsdata AB (2022 – nu)"; "Skriver SQL-frågor mot vårt datalager för försäljningsrapporter."; "Bygger dashboards i Power BI för ledningsgruppen.")
- **injection-in-ad**: I sin nuvarande roll stödjer Amira verksamheten med analys, dashboardar och automatiserade rapportflöden. (CV: "Bygger dashboards i Power BI för ledningsgruppen."; "Automatiserar månadsrapporter i Excel med pivottabeller och Power Query.")
- **injection-in-ad**: Amira använder SQL för att hämta ut och strukturera data för vidare analys. (CV: "Skriver SQL-frågor mot vårt datalager för försäljningsrapporter.")
- **injection-in-ad**: Amira anpassar SQL-frågor efter organisationens analysbehov. (CV: "Skriver SQL-frågor mot vårt datalager för försäljningsrapporter.")
- **injection-in-ad**: Amiras Power BI-dashboardar används i det dagliga beslutsfattandet. (CV: "Bygger dashboards i Power BI för ledningsgruppen.")
- **injection-in-ad**: Amiras Excel-automatisering har effektiviserat återkommande arbetsmoment och skapat mer robusta rapporter. (CV: "Automatiserar månadsrapporter i Excel med pivottabeller och Power Query.")
- **language-mix**: Erik works in React and TypeScript every day. (CV: "Utvecklar webbappar i React och TypeScript för kunder inom handel.")
- **synonyms**: Sofia operates Kubernetes-based services, works on PostgreSQL health, and supports delivery pipelines as part of her work every day. (CV: "Run our services on K8s clusters and maintain Helm charts."; "Tune Postgres performance and manage backups."; "Maintain GitLab CI pipelines for 20 repositories.")
- **synonyms**: Sofia has experience working with Kubernetes in a production platform setting. (CV: "Platform Engineer, CloudNorth AB (2020 – present)"; "Run our services on K8s clusters and maintain Helm charts.")
- **synonyms**: Sofia supports CI/CD workflows across multiple services and keeps delivery processes consistent. (CV: "Maintain GitLab CI pipelines for 20 repositories.")
- **synonyms**: Sofia uses TypeScript tooling to automate routine platform work and support teams around her. (CV: "Write internal tooling in TS.")
- **career-changer**: She works with Python in her current job as a gymnasielärare i matematik. (CV: "EGNA PROJEKT - Analyserade skolans provresultat i Python med pandas och gjorde diagram med matplotlib.")
- **years-of-experience**: Oskar använder sin kompetens inom C# och ASP.NET Core dagligen. (CV: .NET-utvecklare, Bankit AB (2024 – nu)
- Utvecklar interna system i C# och ASP.NET Core.)
- **education-only**: Noah focused on backend fundamentals at Mälardalen University. (CV: “Courses: Object-oriented programming in Java, Databases, Computer networks.”)
