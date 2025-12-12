## What are you currently working on?

I'm actively building three production platforms that showcase my full-stack and AI/ML capabilities:

1. GenZDealZ Credit Scoring (https://credit.GenZDealZ.ai)

   - AI-powered alternative credit scoring system targeting 300M+ credit-invisible GenZ users globally
   - Built complete ML pipeline: FastAPI backend, Next.js 15 frontend, CatBoost/LightGBM/XGBoost models
   - Achieved 87% model accuracy on 300k synthetic profiles with SHAP-based explainability
   - Integrated 7 OAuth providers: GitHub, YouTube, Twitch, Instagram, X/Twitter, LinkedIn, DigiLocker
   - RBI guidelines and PDP Act 2023 compliant architecture

2. iWebtechno (https://www.iwebtechno.com)

   - Enterprise SaaS platform for universities with 7+ integrated modules
   - Built custom Morphy UI design system with Tailwind CSS, dark/light mode, responsive design
   - Tech: Next.js 15, TypeScript, React, GSAP animations, Phosphor Icons
   - Modules: Admissions, Attendance, Exams, HRMS, Finance, Purchase Inventory, Portal GAD

3. TowerIQ (Live on Azure)
   - Telecom infrastructure management platform deployed on Azure App Service
   - Tech: Next.js 15, TypeScript, NextAuth.js, Framer Motion, Docker containerized
   - Features: Tower monitoring, device management, security policy enforcement

---

## Tell us about the most challenging project you've ever worked on (Past Enterprise Work)

I led an enterprise cloud migration of HR documents from on-premise SharePoint 2013 to SharePoint Online for over 10,000 employees at Disney.

Core challenges:
Scale: Migrated and logged over 1M+ sensitive files with complex metadata and tight regulatory controls.
Security: Developed custom logic to accurately map legacy Active Directory permissions to Azure AD, adapting unique business rules for each document set.
Compliance & Audit: Engineered secure frontends to prevent overexposure, ensured real-time permission control, and maintained comprehensive audit trails.
Searchability: Built custom .NET OCR services on Azure Functions. Every scanned document was digitized, embedded with employee codes, and validated for compliance; non-compliant files were automatically rejected.
Automation: Integrated with Workday to automate daily employee join/leave workflows, ensuring document, access, and audit logs were always up-to-date.
Customization: Delivered tailored solutions as required, contributed to the BRD drafts, and participated in interactive weekly client meetings to gather and track requirements closely at Disney.

Results:
Delivered a robust, secure cloud solution for HR, enabling safe document access, granular permission handling, and optimized document search for a large enterprise, all while meeting strict compliance requirements.

---

## What excites you about joining Endgame?

What excites me about joining Endgame is the chance to build advanced AI-driven products with real impact. As a passionate gamer, I have spent over 10,000 hours playing Dota 2, which I consider advanced chess for its strategic complexity. I thrive in competitive environments where teamwork and innovative problem-solving drive success. Endgame’s mission and culture closely match my energy and ambition to deliver intelligent technology and grow alongside high-performing peers.

---

## What's your favorite chess opening and why?

Honestly, I don't follow chess openings by the book. My experience is rooted in competitive gaming, especially Dota 2, which I see as advanced chess for its strategic depth. I’m excited to learn more about chess and expand my strategic skills through this project.

I have experience working in remote and asynchronous environments where AI-assisted development, particularly using tools like Cursor, is a key part of our workflow. To maintain consistency across the team despite differing schedules and locations, we established a set of guidelines for AI usage, coding styles, design principles, and contextual documentation. This ensures that all developers follow a uniform approach, minimizes deviations, and allows the business to clearly track project progress asynchronously. One challenge we faced was ensuring everyone adhered to the same standards without real-time oversight, which we addressed by regularly updating documentation and providing clear examples to guide the team. This AI-first approach has been instrumental in my current work building production AI/ML systems like GenZDealZ, where I architected a complete ML pipeline using a provider-first architecture with synthetic data generation. I developed a domain-first approach where specialist models are trained per provider (GitHub, YouTube, LinkedIn, etc.) on 300k synthetic profiles, then aggregated through a meta-learner. This methodology achieved 87% model accuracy on synthetic datasets, enabling scalable and reproducible ML pipeline development while maintaining compliance with RBI guidelines and PDP Act 2023. The synthetic data approach allows for robust model training and validation before production deployment, demonstrating how engineering best practices in data curation and model architecture directly impact product quality and delivery speed.

---

## Professional Philosophy

I treat every product as an extension of my own brand, crafting experiences that create meaningful impact. People value authentic experiences, and I focus on delivering that kind of lasting value.

---

## Devtools & AI Operations

Cursor as primary IDE with ruleset curation

---

## VISA Status Summary

Full Name: Kushal Trivedi
Current Location: San Mateo, CA
Hourly rate on C2C/W2: 80 USD/hr CTC and 70 USD/hr W2
Work Authorization: F-1 OPT (EAD Valid Until Feb 2028)
Earliest Available date to start: Immediate
Date and times available to interview: Anyday after 11AM PST
Two Professional References:(Preferably Supervisory references):

---

## Based on the role's emphasis on "solutioning" and delivering tailored product demonstrations, can you describe a time when you successfully identified and addressed a client's unique business challenge through a strategic technology solution? What was the outcome?

At Disney Star, Pro Kabaddi League franchises and match operators needed real-time lifecycle management through mobile devices. The challenge: franchises and operators are on-site, constantly moving around during matches and events, making desktop or laptop access inconvenient. They needed real-time lifecycle management capabilities from mobile devices, but the application was hosted on SharePoint Online, which lacked native mobile support for optimal user experience.

As Lead of the SharePoint Online vertical, I architected the API flow connecting SharePoint Online with Microsoft 365 products, using Microsoft 365 custom workflows as an API proxy layer to bridge the gap. I implemented:

- Secure SSO authentication via Okta, later migrating to Disney's MyID
- Redis caching strategies for performance optimization
- Microsoft Entra ID-based permission management at API endpoints
- REST API architecture for the Flutter mobile team to consume

The outcome: Successfully enabled 12 team franchises and 20+ match operators to manage season creation, auctions, team mapping, start sheets, match reports, and awards in real-time from mobile devices while on-the-go, transforming on-site operations efficiency.

---

## This role requires strong innovation management skills, including streamlining decision-making processes and building stakeholder consensus. Can you share an example where you introduced or facilitated a governance process or framework that delivered long-term value for a client or organization?

At Disney Star, I led the migration of 1M+ HR documents to SharePoint Online for 10,000+ employees. The challenge was establishing a governance framework to map legacy Active Directory permissions to Azure AD while meeting compliance requirements across multiple stakeholders (HR, IT, Legal, Compliance).

I facilitated a governance process that included:

- Weekly client meetings to gather requirements and build consensus across departments
- Contributing to BRD drafts to document permission mapping rules and business logic unique to each document set
- Establishing automated approval workflows integrated with Workday for employee lifecycle events
- Creating audit trail mechanisms for compliance tracking and real-time permission control
- Building OCR validation rules to automatically reject non-compliant documents

The framework delivered long-term value by:

- Ensuring regulatory compliance with comprehensive audit trails
- Enabling secure, granular permission management that adapted to organizational changes
- Automating daily join/leave workflows, reducing manual overhead
- Providing safe document access with optimized search for enterprise-scale operations

This governance model became the foundation for subsequent HR and compliance projects at the organization.

---

## The Sales Engineer at you.com collaborates with cross-functional teams and engages in technical leadership. How have you previously led or coordinated a team to deliver a complex solution while aligning with strategic business objectives? What approaches did you use to ensure success?

At Disney Star via Xangam consultancy, as Lead of the SharePoint Online vertical, I coordinated across multiple internal and external teams to deliver enterprise solutions for HR document management, Pro Kabaddi League operations, and later Akasa Air's intranet system.

For the HR system serving 10,000+ employees, I acted as the technical bridge between Disney's HR team for requirements, Azure infrastructure team for Functions deployment, IT support team for email configurations, Workday integration team for employee lifecycle automation, and Xangam's consultancy team interfacing with Legal and Compliance. I translated business requirements from weekly client meetings into technical specifications each team could execute.

For Pro Kabaddi League, I coordinated with 12 team franchises, 20+ match operators, the Flutter mobile development team consuming our REST APIs, Okta team and later Disney's MyID team for SSO authentication, and Redis infrastructure team for caching strategies. The franchises and operators are on-site, constantly moving around during matches and events, making desktop or laptop access inconvenient. I architected the API flow connecting SharePoint Online with Microsoft 365 products, using Microsoft 365 custom workflows as an API proxy layer, ensuring each team understood their integration points.

At Akasa Air via Xangam, I led coordination between 4000+ employees across departments, Microsoft 365 team for SharePoint integration, Zoho team for SSO bridging, and Power Automate specialists for workflow automation.

My approach: establishing clear API contracts between teams, maintaining documentation as single source of truth, conducting regular sync meetings to address blockers, and ensuring technical decisions aligned with business objectives. Impact: migrated 100,000+ files for 10,000+ employees at Disney, enabled 12 franchises and 20+ operators for Pro Kabaddi, achieved 40% faster content discovery at Akasa Air.
