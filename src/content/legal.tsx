import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { LEGAL, LEGAL_PLACEHOLDERS, SITE } from '../lib/site';

/**
 * DRAFT legal templates.
 *
 * These are starting points only. They are NOT legal advice, they have NOT
 * been reviewed by a lawyer, and they make no claim that the operator holds
 * any licence, registration, certification or approval. Have every page
 * reviewed by a qualified lawyer for each country you operate in, fill the
 * placeholders (via VITE_* env vars or by editing this file), and only then
 * set LEGAL_DRAFT to false.
 */
export const LEGAL_DRAFT = true;
export const LEGAL_LAST_UPDATED = '[DATE OF LAST REVIEW]';

/** Configured value, or a clearly visible placeholder token. */
export function Ph({ k }: { k: keyof typeof LEGAL_PLACEHOLDERS }) {
  const v = LEGAL[k];
  return v ? <>{v}</> : <span className="placeholder-token">{LEGAL_PLACEHOLDERS[k]}</span>;
}

function Mail() {
  return LEGAL.email ? <a className="text-flame-soft underline" href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a> : <Ph k="email" />;
}

export interface LegalPage {
  slug: string;
  navLabel: string;
  title: string;
  summary: string;
  body: () => ReactNode;
}

const S = SITE.name;

export const LEGAL_PAGES: LegalPage[] = [
  {
    slug: 'terms',
    navLabel: 'Terms & Conditions',
    title: 'Terms & Conditions',
    summary: `The rules for using ${S}.`,
    body: () => (
      <>
        <p>
          These Terms &amp; Conditions (“Terms”) govern your use of {S} (the “Service”), operated by <Ph k="entity" />, <Ph k="address" />,{' '}
          <Ph k="country" /> (“we”, “us”). By accessing the Service you agree to these Terms. If you do not agree, do not use the Service.
        </p>
        <h2>1. Adults only</h2>
        <p>
          The Service contains sexually explicit material. You may use it only if you are at least 18 years old and have reached the age of majority
          where you live, and only where viewing such material is lawful. See our <Link to="/legal/age-policy">Age Policy</Link>.
        </p>
        <h2>2. Accounts</h2>
        <ul>
          <li>You are responsible for keeping your login details secure and for activity under your account.</li>
          <li>Provide accurate information. We may suspend or close accounts that break these Terms.</li>
          <li>You may delete your account by contacting <Mail />.</li>
        </ul>
        <h2>3. Content on the Service</h2>
        <p>
          Content is published by the Service’s administrators. Everyone depicted must have been 18 or older at the time of recording and must have
          consented to the recording and to its publication — see the <Link to="/legal/consent-policy">Consent / Performer Policy</Link>. We may
          remove or restrict any content at our discretion.
        </p>
        <h2>4. Acceptable use</h2>
        <p>Your use must comply with the <Link to="/legal/acceptable-use">Acceptable Use Policy</Link>.</p>
        <h2>5. Intellectual property</h2>
        <p>
          The Service’s software, design and branding belong to <Ph k="entity" /> or its licensors. Content remains the property of its respective
          owners. To report infringement, see the <Link to="/legal/copyright">Copyright Notice</Link>.
        </p>
        <h2>6. Advertising and third-party links</h2>
        <p>
          The Service shows advertisements, some supplied by third parties and displayed in isolated frames. We are not responsible for third-party
          sites or offers.
        </p>
        <h2>7. Disclaimers and limitation of liability</h2>
        <p>
          The Service is provided “as is” and “as available”. To the maximum extent permitted by law, we disclaim implied warranties and are not liable
          for indirect or consequential losses. Nothing in these Terms limits liability that cannot be limited by law.{' '}
          <span className="placeholder-token">[LAWYER TO ADAPT TO GOVERNING LAW AND CONSUMER RULES]</span>
        </p>
        <h2>8. Changes and termination</h2>
        <p>We may update these Terms. Material changes will be highlighted on the Service. We may suspend access for breach of these Terms.</p>
        <h2>9. Governing law</h2>
        <p>These Terms are governed by the laws of <Ph k="country" />, subject to any mandatory consumer protections where you live.</p>
        <h2>10. Contact</h2>
        <p>Questions: <Mail />.</p>
      </>
    ),
  },
  {
    slug: 'privacy',
    navLabel: 'Privacy Policy',
    title: 'Privacy Policy',
    summary: 'What we collect, why, and your choices.',
    body: () => (
      <>
        <p>
          This policy explains how <Ph k="entity" /> (“we”) handles personal data on {S}. Controller contact: <Mail />, <Ph k="address" />.
        </p>
        <h2>Data we process</h2>
        <ul>
          <li><strong>Account data</strong> (if you sign up): email address, optional display name, login timestamps.</li>
          <li><strong>Likes</strong>: which posts you liked, linked to your account or to an anonymous session if you like without an account.</li>
          <li>
            <strong>View counting</strong>: a random identifier stored in your browser. The database stores only a one-way hash of it, used to count
            one view per viewer per day and to limit abuse. We do not use your IP address for this.
          </li>
          <li>
            <strong>Search statistics</strong>: the text of searches (normalised), how often they are made and a result count — without any user, IP or
            session identifier. Searches that look like emails, links or long numbers are discarded.
          </li>
          <li>
            <strong>Removal requests and reports</strong>: the email, optional name and details you provide, and a hashed browser identifier for spam
            protection.
          </li>
          <li>
            <strong>On your device only</strong>: your age-gate choice, recent searches and the random identifier above, stored in your browser’s local
            storage. You can clear them at any time.
          </li>
          <li><strong>Technical logs</strong> kept by our hosting and database providers for security and reliability.</li>
        </ul>
        <h2>Why we process it</h2>
        <ul>
          <li>To provide the Service and your account (contract).</li>
          <li>To count views, prevent abuse and keep the Service secure (legitimate interests).</li>
          <li>To handle removal requests, reports and legal obligations (legal obligation / legitimate interests).</li>
        </ul>
        <h2>Processors and transfers</h2>
        <p>
          We use service providers such as our database/authentication host and our website host/CDN, and an email provider if configured to send
          request confirmations. <span className="placeholder-token">[LIST PROVIDERS, LOCATIONS AND TRANSFER SAFEGUARDS]</span>
        </p>
        <h2>Advertising</h2>
        <p>
          Ads are shown inside isolated frames that cannot read your account or this site’s data. Advertisers may set their own cookies under their own
          policies. <span className="placeholder-token">[DESCRIBE AD PARTNERS AND CONSENT MECHANISM REQUIRED IN YOUR MARKETS]</span>
        </p>
        <h2>Retention</h2>
        <p>
          Raw view events are kept for up to 90 days; aggregated counts are kept. Removal requests and moderation records are kept for{' '}
          <span className="placeholder-token">[RETENTION PERIOD]</span> or as required by law.
        </p>
        <h2>Your rights</h2>
        <p>
          Depending on where you live you may have rights to access, correct, delete, restrict or object to processing, and to complain to a data
          protection authority. Contact <Mail />.
        </p>
        <h2>Children</h2>
        <p>The Service is for adults only. We do not knowingly collect data from anyone under 18.</p>
      </>
    ),
  },
  {
    slug: 'copyright',
    navLabel: 'Copyright / DMCA Notice',
    title: 'Copyright / DMCA-Style Notice',
    summary: 'How to report copyright infringement.',
    body: () => (
      <>
        <p>
          We respect intellectual property rights. If you believe content on {S} infringes your copyright, send a notice using the{' '}
          <Link to="/report">removal request form</Link> (reason “I own the copyright”) or to our designated agent:
        </p>
        <p className="panel p-4 text-sm">
          <strong>Designated agent:</strong> <Ph k="dmcaAgent" />
          <br />
          <strong>Email:</strong> <Mail />
          <br />
          <strong>Address:</strong> <Ph k="address" />
        </p>
        <h2>What to include</h2>
        <ul>
          <li>Identification of the copyrighted work.</li>
          <li>The link(s) to the material on {S}.</li>
          <li>Your contact details (name, address, email).</li>
          <li>A statement that you have a good-faith belief the use is not authorised by the owner, its agent or the law.</li>
          <li>A statement that the information is accurate and, under penalty of perjury, that you are the owner or authorised to act for the owner.</li>
          <li>Your physical or electronic signature.</li>
        </ul>
        <h2>Counter-notices</h2>
        <p>If your content was removed and you believe this was a mistake, contact <Mail /> with the details required by applicable law.</p>
        <h2>Repeat infringers</h2>
        <p>We may terminate accounts of repeat infringers in appropriate circumstances.</p>
        <p className="text-sm text-muted">
          Note: registration of a designated agent with the U.S. Copyright Office is only relevant if you rely on U.S. safe-harbour rules.{' '}
          <span className="placeholder-token">[CONFIRM WITH COUNSEL WHETHER AND WHERE REGISTRATION IS REQUIRED]</span>
        </p>
      </>
    ),
  },
  {
    slug: 'content-removal',
    navLabel: 'Content Removal Policy',
    title: 'Content Removal Policy',
    summary: 'How removal requests are handled.',
    body: () => (
      <>
        <p>
          Anyone can ask us to remove content — including people depicted, copyright owners, and anyone concerned about consent, privacy or age. Every
          content page has a <strong>Report / Request removal</strong> button, and you can also use the <Link to="/report">general form</Link>.
        </p>
        <h2>How it works</h2>
        <ol className="ml-5 list-decimal space-y-1.5">
          <li>You submit a request with your email address and details. You receive a reference number on screen.</li>
          <li>The request is stored and the content is flagged for review.</li>
          <li>A moderator reviews the request and the content.</li>
          <li>We decide to keep, hide or remove the content, and record the decision.</li>
          <li>We reply to the email you provided.</li>
        </ol>
        <h2>Priorities</h2>
        <p>
          Requests from people depicted, and concerns about consent or possible minors, are treated as urgent and reviewed first. Content may be hidden
          while an urgent request is reviewed. Target review time: <span className="placeholder-token">[TARGET RESPONSE TIME]</span>.
        </p>
        <h2>No automatic deletion</h2>
        <p>
          Submitting a request does not automatically delete content; a person reviews it. This protects against false or abusive requests. Knowingly
          false requests may breach the <Link to="/legal/terms">Terms</Link>.
        </p>
        <h2>Illegal material</h2>
        <p>
          If you believe content shows a minor or non-consensual activity, report it immediately via the form. You can also report child sexual abuse
          material to the <a href="https://report.cybertip.org/" target="_blank" rel="noopener noreferrer" className="underline">NCMEC CyberTipline</a> or the{' '}
          <a href="https://report.iwf.org.uk/" target="_blank" rel="noopener noreferrer" className="underline">Internet Watch Foundation</a>.
        </p>
      </>
    ),
  },
  {
    slug: 'age-policy',
    navLabel: 'Age Policy',
    title: 'Age Policy',
    summary: 'Adults only — for viewers and everyone depicted.',
    body: () => (
      <>
        <h2>Viewers</h2>
        <p>
          {S} is only for adults aged 18+ (or the age of majority where you live, if higher). Before entering, visitors must confirm they are adults.
          This confirmation is a self-declaration stored on your device; it is <strong>not</strong> a formal age-verification check.
        </p>
        <p>
          Some jurisdictions require stronger age assurance (for example, verified age checks). Where required, we intend to use an appropriate
          age-verification provider. <span className="placeholder-token">[DESCRIBE JURISDICTIONS AND PROVIDER ONCE IMPLEMENTED]</span>
        </p>
        <h2>People depicted</h2>
        <p>
          Everyone appearing in content must have been at least 18 years old at the time the content was created. See the{' '}
          <Link to="/legal/consent-policy">Consent / Performer Policy</Link>.
        </p>
        <h2>Protecting minors</h2>
        <p>
          The site identifies itself as adult content so parental-control and filtering tools can block it. Parents can use device and network filters
          to restrict access.
        </p>
        <h2>Reporting</h2>
        <p>If you believe anyone depicted is under 18, <Link to="/report">report it immediately</Link>. We treat these reports as urgent.</p>
      </>
    ),
  },
  {
    slug: 'consent-policy',
    navLabel: 'Consent / Performer Policy',
    title: 'Consent / Performer Policy',
    summary: 'Consent and age requirements for all content.',
    body: () => (
      <>
        <p>We only want content made and shared with the full, informed consent of every person in it.</p>
        <h2>Requirements for all content</h2>
        <ul>
          <li>Every person depicted was 18 or older when the content was created.</li>
          <li>Every person depicted consented to being recorded and to the content being published on {S}.</li>
          <li>The uploader holds the rights needed to publish the content.</li>
          <li>No hidden-camera, leaked, stolen, “revenge”, coerced or otherwise non-consensual content.</li>
        </ul>
        <h2>Records</h2>
        <p>
          Administrators record, for each item, the status of consent documentation, age/identity verification of performers and the ownership basis,
          with a reference to where the underlying records are held by the custodian of records. Identity documents are not stored in the public media
          storage.
        </p>
        <p>
          Custodian of records: <span className="placeholder-token">[NAME AND ADDRESS OF CUSTODIAN OF RECORDS — IF REQUIRED IN YOUR JURISDICTION, E.G. 18 U.S.C. § 2257]</span>
        </p>
        <h2>Withdrawal and disputes</h2>
        <p>
          If you appear in content and did not consent, or wish to withdraw, use the <Link to="/report">removal request form</Link> and choose “I am
          the person depicted” or “Consent issue”. These requests are urgent.
        </p>
      </>
    ),
  },
  {
    slug: 'acceptable-use',
    navLabel: 'Acceptable Use Policy',
    title: 'Acceptable Use Policy',
    summary: 'What is not allowed on the Service.',
    body: () => (
      <>
        <p>You must not use {S} to:</p>
        <ul>
          <li>Access the Service if you are under 18 or where adult content is unlawful for you.</li>
          <li>Upload, request or share material involving minors, non-consensual acts, or anyone who has not consented.</li>
          <li>Share another person’s private information or intimate images without consent.</li>
          <li>Infringe copyright or other rights.</li>
          <li>Harass, threaten or exploit anyone, or promote violence or trafficking.</li>
          <li>Artificially inflate views or likes, scrape the Service at scale, or use bots, click farms or automated traffic.</li>
          <li>Probe, attack or bypass security controls, or submit false or abusive reports.</li>
        </ul>
        <p>We may remove content, restrict features or close accounts that break this policy, and report illegal activity to the authorities.</p>
      </>
    ),
  },
  {
    slug: 'contact',
    navLabel: 'Contact',
    title: 'Contact',
    summary: 'How to reach us.',
    body: () => (
      <>
        <p className="panel p-4 text-sm">
          <strong><Ph k="entity" /></strong>
          <br />
          <Ph k="address" />
          <br />
          <Ph k="country" />
          <br />
          Email: <Mail />
        </p>
        <ul>
          <li>To remove content or report a problem with a post, use <Link to="/report">Report content</Link> or the button on the post — it is the fastest route.</li>
          <li>Copyright notices: see the <Link to="/legal/copyright">Copyright Notice</Link>.</li>
          <li>Privacy requests: email us with “Privacy request” in the subject.</li>
        </ul>
      </>
    ),
  },
];

export function findLegalPage(slug: string | undefined): LegalPage | undefined {
  return LEGAL_PAGES.find((p) => p.slug === slug);
}
