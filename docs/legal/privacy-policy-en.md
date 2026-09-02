# PlotOps Personal Data Processing Policy

**Version:** 1.2  
**Publication date:** September 1, 2026  
**Service website:** https://plotops.webrunner.dev

---

## 1. General provisions

1.1. This Personal Data Processing Policy (the **Policy**) defines the procedure for collection, processing, storage, and protection of personal data of users of the **PlotOps** web service (the **Service**) and is developed in accordance with the Law of the Republic of Kazakhstan dated May 21, 2013 No. 94-V “On Personal Data and Their Protection” (the **Personal Data Law**).

1.2. The **personal data operator** (the **Operator**) is an individual who administers the PlotOps Service for non-commercial purposes. A legal entity name is not specified in the Policy due to the nature of the Service as a personal non-commercial project.

1.3. **Contact for data subject inquiries:** the email address published on the Service website in settings, on the “About” page, or in the project repository on GitHub.

1.4. The Policy is an integral part of the [Terms of Use](/terms).

---

## 2. Categories of data subjects and personal data

2.1. Data subjects are registered users of the Service and persons who have sent inquiries to the Operator.

2.2. Users of the “Try demo” guest mode, whose data is processed exclusively locally in the browser, are **not** subjects of server-side personal data processing by the Operator.

2.3. The Operator may process the following categories of personal data:

| Category           | Data elements                                           | Source               |
| ------------------ | ------------------------------------------------------- | -------------------- |
| Identification     | first name, last name, email address, user identifier   | registration, OAuth  |
| Authentication     | password hash, session tokens                           | Supabase Auth        |
| OAuth profile data | GitHub login, avatar URL, Google identifier             | GitHub, Google       |
| Work data          | tasks, comments, uploads, team settings                 | use of the Service   |
| Technical          | IP address, User-Agent, cookies                         | automatic collection |
| Communications     | service emails (registration confirmation, invitations) | sent by the Operator |

2.4. The Operator **does not** intentionally collect special or biometric categories of personal data.

---

## 3. Purposes and legal bases of processing

3.1. Personal data is processed for the following purposes:

- registration, authentication, and administration of an Account;
- provision of Service functionality;
- integration with third-party services (GitHub, Google);
- ensuring Service security (including via Cloudflare Turnstile);
- sending service notifications;
- compliance with the legislation of the Republic of Kazakhstan.

3.2. Legal bases for processing include:

- consent of the data subject;
- processing necessary for performance of a contract (Terms of Use);
- other bases provided by the Personal Data Law.

---

## 4. Processing methods

4.1. The Operator collects, records, organizes, stores, updates, uses, transfers (provides access), blocks, and destroys personal data using automated means and/or otherwise.

---

## 5. Storage and data localization

5.1. Personal data is hosted on infrastructure of the following third parties:

| Component                              | Infrastructure provider | Note                                                   |
| -------------------------------------- | ----------------------- | ------------------------------------------------------ |
| Database, authentication, file storage | Supabase Inc.           | region determined by cloud project settings            |
| Protection and content delivery        | Cloudflare              | global infrastructure                                  |
| OAuth and API                          | GitHub, Google          | United States, European Union, and other jurisdictions |

5.2. In accordance with **Article 12 of the Personal Data Law**, collection and storage of personal data of citizens of the Republic of Kazakhstan must be carried out on the territory of the Republic of Kazakhstan unless otherwise provided by law.

5.3. Due to use of foreign cloud infrastructure, personal data may be processed **outside the Republic of Kazakhstan**. The Operator informs the data subject of cross-border transfer; consent to such transfer is provided by the data subject through an active action at registration (acceptance of the Policy).

5.4. Personal data is retained until Account deletion, and for **30 (thirty) calendar days** thereafter for backup and security log purposes, unless a longer period is required by law.

---

## 6. Disclosure of personal data to third parties

6.1. The Operator may disclose personal data to:

- infrastructure providers (Supabase, Cloudflare);
- OAuth providers (GitHub, Google) — to the extent necessary for integration;
- government authorities of the Republic of Kazakhstan — on a lawful basis and in the prescribed manner.

6.2. The Operator **does not** sell personal data.

---

## 7. Rights of the data subject

7.1. A data subject has the right to:

1. receive information about the existence and processing of their personal data;
2. request correction, blocking, or deletion of personal data where grounds provided by law exist;
3. withdraw consent to personal data processing;
4. appeal the Operator’s actions to the authorized government body for personal data protection in accordance with the legislation of the Republic of Kazakhstan.

7.2. To exercise their rights, the data subject sends a request to the contact email address specified in Section 1.3 of this Policy. The review period is **15 (fifteen) business days**, unless a different period is established by law.

7.3. Withdrawal of consent may make further use of the Service impossible and result in deletion of the Account.

---

## 8. Data subject consent

8.1. Consent is provided through an **active action** by the User: checking a box on the registration form (without pre-selection) or other explicit confirmation provided by the Service interface.

8.2. Recommended wording for the interface:

> “I have read the Terms of Use and the Personal Data Processing Policy and consent to the collection and processing of my personal data, including cross-border transfer, to the extent specified in the Policy.”

---

## 9. Cookies

9.1. The Service uses technically necessary cookies (session, interface language, theme).

9.2. Advertising and analytics tracking systems are **not used**.

---

## 10. Personal data security measures

10.1. The Operator applies organizational and technical measures, including:

- encryption of data in transit via HTTPS;
- access control to data (Row Level Security in PostgreSQL);
- storage of passwords as cryptographic hashes.

10.2. Absolute protection of information during transmission and storage over the Internet cannot be guaranteed.

10.3. If an incident creating a risk to data subjects’ rights is identified, the Operator takes measures in accordance with the requirements of the legislation of the Republic of Kazakhstan.

---

## 11. Changes to the Policy

11.1. The Operator may amend this Policy by publishing a new version on the Website.

11.2. Registered users will be notified of material changes via the Website and/or email before changes take effect, when possible.
