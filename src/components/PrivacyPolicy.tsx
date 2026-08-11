import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  legalCardClass,
  legalCloseBtnClass,
  legalContentClass,
  legalLastUpdatedClass,
  legalPageContainerClass,
} from './legal/legalPageClasses';

export const PrivacyPolicy: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className={legalPageContainerClass}>
      <div className={legalCardClass}>
        <button className={legalCloseBtnClass} onClick={() => navigate(-1)} title="Exit fullscreen">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>

        <div className={legalContentClass}>
          <h1>Privacy Policy</h1>
          <p className={legalLastUpdatedClass}>Last updated: July 2026</p>
          <p>This Privacy Policy explains how Langey ("we," "us," "our," or "Company") collects, uses, shares, and protects your information when you use our website and services.</p>

          <section>
            <h2>1. Data Controller & Jurisdiction</h2>
            <p>Langey is the data controller of your personal data. Our data processing facilities are located in West Europe (Ireland), which is within the European Union. We comply with the General Data Protection Regulation (GDPR) and other applicable data protection laws.</p>
            <p><strong>Data Protection Officer / Contact:</strong> For privacy-related inquiries, please contact us at <a href="mailto:info@langey.com">info@langey.com</a></p>
          </section>

          <section>
            <h2>2. Data We Collect</h2>
            <p>We collect only the minimum necessary data to provide our service:</p>
            <ul>
              <li><strong>Consumer ID:</strong> A unique anonymous identifier assigned to your browser/device to track your learning progress across sessions.</li>
              <li><strong>Learning Progress Data:</strong> Quiz scores, exercise results, completed lessons, language level, and learning streaks.</li>
              <li><strong>Email Address:</strong> Your email is collected only when you voluntarily sign in with Google to sync your progress across devices.</li>
              <li><strong>Google Account Information:</strong> When you sign in with Google, we receive your email address and basic profile information from Google's OAuth provider.</li>
              <li><strong>Local Storage Data:</strong> Browser local storage is used to store your progress, state preferences, and session information on your device.</li>
              <li><strong>Device/Browser Information:</strong> IP address, browser type, operating system, and general location data (country-level only, not precise location).</li>
            </ul>
          </section>

          <section>
            <h2>3. Legal Basis for Data Processing (GDPR Article 6)</h2>
            <p>We process your data based on the following legal bases:</p>
            <ul>
              <li><strong>Performance of Contract (Article 6(1)(b)):</strong> When you create an account and log in with Google, we process your email to fulfill our contractual obligation to sync your learning progress across devices.</li>
              <li><strong>Legitimate Interest (Article 6(1)(f)):</strong> 
                <ul>
                  <li>Anonymous progress tracking using Consumer ID to improve user experience</li>
                  <li>Detecting and preventing abuse or technical issues</li>
                </ul>
              </li>
            </ul>
          </section>

          <section>
            <h2>4. Purpose of Data Collection</h2>
            <p>Your data is used exclusively for:</p>
            <ul>
              <li>Providing and personalizing the Langey German language learning experience</li>
              <li>Saving and syncing your progress across devices (when you choose to log in)</li>
              <li>Detecting technical issues and preventing fraud or abuse</li>
              <li>Communicating about your account (if you contact us or request features)</li>
            </ul>
            <p><strong>Data is never:</strong> Sold to third parties, shared for marketing purposes, or used for profiling or automated decision-making.</p>
          </section>

          <section>
            <h2>5. Data Storage & International Transfers</h2>
            <p><strong>Primary Storage Location:</strong> Your data is stored in Supabase, with databases located in West Europe (Ireland/EU region).</p>
            <p><strong>International Transfers:</strong> We do not intentionally transfer personal data outside the EU. If any transfers occur as part of essential third-party services, we ensure appropriate safeguards are in place, including Standard Contractual Clauses (SCCs) or other GDPR-compliant mechanisms.</p>
            <p><strong>Data Security:</strong> We implement industry-standard encryption (TLS/SSL), secure authentication, and regular security reviews to protect your data.</p>
          </section>

          <section>
            <h2>6. Cookies & Local Storage</h2>
            <p><strong>Strictly Necessary Storage (No Consent Required):</strong></p>
            <ul>
              <li>Browser local storage to maintain your session and save learning progress (required for core functionality)</li>
              <li>Session identifiers to keep you logged in</li>
            </ul>
            <p>We do not use analytics, advertising, or retargeting cookies.</p>
          </section>

          <section>
            <h2>7. Third-Party Services & Data Sharing</h2>
            <p>We only share your data with essential third-party providers:</p>
            <ul>
              <li><strong>Google OAuth:</strong> When you sign in with Google, Google handles your authentication. We receive only your email address from Google.</li>
              <li><strong>Google AI Services (Gemini API / Google Cloud Vertex AI):</strong> When you use AI-powered learning features, relevant prompts and context (for example, exercise input and learning-related text/audio) are sent to Google to generate responses. We do not intentionally send payment details or special-category personal data to these AI endpoints.</li>
              <li><strong>Supabase:</strong> Your learning data and account information are stored in Supabase (EU-based). Supabase is a data processor and commits to GDPR compliance.</li>
            </ul>
            <p><strong>AI Data Handling:</strong> AI providers may temporarily process and store request/response data for safety, abuse prevention, debugging, and service reliability under their own terms. Where provider controls are available, we configure services to limit use of customer data for model training.</p>
            <p><strong>AI Output Notice:</strong> AI-generated responses may be incomplete or inaccurate and should be used as learning support only.</p>
            <p><strong>Data Processors:</strong> All third-party processors have signed Data Processing Agreements (DPAs) ensuring compliance with GDPR Article 28.</p>
            <p><strong>Legal Requirements:</strong> We may disclose your data if required by law (e.g., court order, government request) and will notify you unless legally prohibited.</p>
          </section>

          <section>
            <h2>8. Your Rights Under GDPR</h2>
            <p>As a resident of or person located in the EU, you have the following rights regarding your personal data:</p>
            <ul>
              <li><strong>Right of Access (Article 15):</strong> Request a copy of your personal data that we hold.</li>
              <li><strong>Right to Rectification (Article 16):</strong> Correct inaccurate or incomplete data.</li>
              <li><strong>Right to Erasure (Article 17):</strong> Request deletion of your data (subject to legitimate retention periods).</li>
              <li><strong>Right to Restrict Processing (Article 18):</strong> Limit how we use your data in certain circumstances.</li>
              <li><strong>Right to Data Portability (Article 20):</strong> Receive your data in a structured, machine-readable format.</li>
              <li><strong>Right to Object (Article 21):</strong> Object to our processing based on legitimate interest.</li>
              <li><strong>Right to Lodge a Complaint (Article 77):</strong> File a complaint with your local data protection authority if you believe your rights have been violated.</li>
            </ul>
            <p>To exercise any of these rights, contact us at <a href="mailto:info@langey.com">info@langey.com</a>. We will respond within 30 days (up to 90 days for complex requests).</p>
          </section>

          <section>
            <h2>9. Data Retention & Deletion Policy</h2>
            <p><strong>Anonymous Consumer ID & Progress Data:</strong> Retained while your account is active. After account deletion, retained for up to 90 days for backup recovery and abuse prevention, then automatically purged.</p>
            <p><strong>Email Address (if logged in with Google):</strong> Retained as long as your account is active. Deleted immediately upon account deletion or sign-out.</p>
            <p><strong>Local Storage Data:</strong> Stored only on your device and is within your control. Clear your browser's local storage to remove it immediately.</p>
            <p><strong>Account Deletion Process:</strong></p>
            <ul>
              <li><strong>Standard Deletion (30-day grace period):</strong> When you request account deletion, we mark your account as deleted and retain your data for 30 days in case you change your mind. You can reactivate during this period.</li>
              <li><strong>Permanent Deletion:</strong> If you want immediate permanent deletion of all your data, please contact us at <a href="mailto:info@langey.com">info@langey.com</a>. We will permanently delete your account within 7 business days.</li>
            </ul>
          </section>

          <section>
            <h2>10. Children's Privacy</h2>
            <p>Our service is not intentionally directed to children under 13 (or the applicable age of digital consent in your country). We do not knowingly collect personal data from children. If we become aware that we've collected data from a child without parental consent, we will delete it immediately. Parents/guardians who believe their child's data has been collected should contact us at <a href="mailto:info@langey.com">info@langey.com</a>.</p>
          </section>

          <section>
            <h2>11. Data Breach Notification</h2>
            <p>In the event of a data breach that compromises your personal data, we will notify affected users without undue delay (within 72 hours of discovery) as required by GDPR Article 33. Notifications will be sent to your email address or posted on our website. We will provide details about the breach, affected data, and recommended actions.</p>
          </section>

          <section>
            <h2>12. Policy Updates</h2>
            <p>We may update this Privacy Policy periodically to reflect changes in our practices or applicable laws. Significant changes will be communicated via email or a prominent notice on our website. Your continued use of Langey after updates constitutes acceptance of the revised policy.</p>
          </section>

          <section>
            <h2>13. Contact Us</h2>
            <p>For privacy-related questions, requests, complaints, or to exercise your rights:</p>
            <ul>
              <li><strong>Email:</strong> <a href="mailto:info@langey.com">info@langey.com</a></li>
              <li><strong>Response Time:</strong> We aim to respond within 7 days of your request</li>
            </ul>
            <p>If you are unsatisfied with our response or believe your rights have been violated, you have the right to lodge a complaint with your local Data Protection Authority (DPA).</p>
          </section>

          <section>
            <h2>14. Data Protection Authority</h2>
            <p>If you are located in Ireland (where our servers are based), you may contact:</p>
            <ul>
              <li><strong>Data Protection Commission (DPC)</strong><br/>
              Phone: +353 57 8684800<br/>
              Website: <a href="https://www.dataprotection.ie/" target="_blank">https://www.dataprotection.ie/</a>
              </li>
            </ul>
            <p>For other EU countries, you can find your local DPA contact information on the EDPB website: <a href="https://edpb.ec.europa.eu/" target="_blank">https://edpb.ec.europa.eu/</a></p>
          </section>
        </div>
      </div>
    </div>
  );
};
