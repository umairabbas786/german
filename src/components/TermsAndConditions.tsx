import React from 'react';
import { useNavigate } from 'react-router-dom';
import {
  legalCardClass,
  legalCloseBtnClass,
  legalContentClass,
  legalLastUpdatedClass,
  legalPageContainerClass,
} from './legal/legalPageClasses';

export const TermsAndConditions: React.FC = () => {
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
          <h1>Terms and Conditions</h1>
          <p className={legalLastUpdatedClass}>Last updated: April 2025</p>
          <p>These Terms and Conditions ("Terms," "Agreement") govern your use of the Langey website, mobile application, and services (collectively, "Service"). By accessing or using Langey, you agree to be bound by these Terms. If you do not agree, please do not use our Service.</p>

          <section>
            <h2>1. Definitions</h2>
            <ul>
              <li><strong>"Company," "we," "us," "our":</strong> Langey and its operators</li>
              <li><strong>"Service":</strong> Our website, application, and all features including German language learning, grammar exercises, and related services</li>
              <li><strong>"User," "you":</strong> Any person accessing or using Langey</li>
              <li><strong>"Content":</strong> Any data, text, exercises, scores, and learning progress on the platform</li>
            </ul>
          </section>

          <section>
            <h2>2. Eligibility & User Accounts</h2>
            <p><strong>Age Requirements:</strong> You must be at least 13 years old (or the applicable age of digital maturity in your jurisdiction) to use Langey. Users under 18 may require parental/guardian consent.</p>
            <p><strong>Account Responsibility:</strong> You are responsible for:</p>
            <ul>
              <li>Maintaining the confidentiality of your account credentials</li>
              <li>All activities under your account, whether authorized by you or not</li>
              <li>Providing accurate, truthful information when signing up</li>
              <li>Notifying us immediately of unauthorized access</li>
            </ul>
            <p><strong>Account Termination:</strong> We reserve the right to terminate your account if we believe you've violated these Terms or engaged in harmful behavior.</p>
          </section>

          <section>
            <h2>3. Service Description & Fair Use</h2>
            <p><strong>What Langey Provides:</strong> Langey is an interactive German language learning platform offering grammar exercises, vocabulary practice, and progress tracking. The Service is provided on an "as-is" basis.</p>
            <p><strong>Daily Credit Limits:</strong> Free users receive a daily limit of credits for practice exercises. Limits reset every 24 hours. Premium users may have higher limits as specified during signup.</p>
            <p><strong>Fair Use Policy:</strong> You agree not to:</p>
            <ul>
              <li>Attempt to bypass daily credit limits through automation or hacking</li>
              <li>Share your account or credentials with others</li>
              <li>Use bots, scrapers, or automated tools to abuse the service</li>
              <li>Attempt to reverse-engineer, decompile, or extract Langey's content or code</li>
              <li>Harass other users or post abusive content</li>
              <li>Use the service for illegal purposes</li>
            </ul>
            <p><strong>Violation Consequences:</strong> Violations may result in account suspension or permanent termination without refund.</p>
          </section>

          <section>
            <h2>4. Intellectual Property Rights</h2>
            <p><strong>Company IP:</strong> All content, design, code, exercises, and materials on Langey are owned by or licensed to Langey and protected by intellectual property laws. You may not reproduce, distribute, or modify them without permission.</p>
            <p><strong>Your Content:</strong> Your learning progress, quiz answers, and exercise results ("User Content") are yours. By using Langey, you grant us a license to use this content to:</p>
            <ul>
              <li>Provide and improve the Service</li>
              <li>Analyze learning patterns and personalize your experience</li>
              <li>Generate anonymized analytics</li>
            </ul>
            <p><strong>No Sale of Content:</strong> We will not sell your User Content to third parties.</p>
          </section>

          <section>
            <h2>5. Payments & Refunds</h2>
            <p><strong>Pricing:</strong> Any paid features (premium subscription, in-app purchases) will display pricing before purchase. Prices may change with 30 days' notice.</p>
            <p><strong>Billing:</strong> If you subscribe to a paid plan, you authorize automatic billing at the stated interval. You can cancel anytime through your account settings.</p>
            <p><strong>Refund Policy:</strong></p>
            <ul>
              <li>Refunds are available within 14 days of purchase (EU consumer protection)</li>
              <li>After 14 days, no refunds for digital content per EU law (Article 16(m), Consumer Rights Directive)</li>
              <li>Exceptions may apply for service failures; contact us at <a href="mailto:info@langey.com">info@langey.com</a></li>
            </ul>
            <p><strong>No Chargeback Abuse:</strong> Chargebacks without contacting us first will result in account termination.</p>
          </section>

          <section>
            <h2>6. Data & Privacy</h2>
            <p><strong>Privacy Policy:</strong> Your data is governed by our separate Privacy Policy (available at /privacy-policy), which is incorporated by reference into these Terms.</p>
            <p><strong>Data Processing:</strong> Langey processes the information required to provide the service as described in our Privacy Policy, including account and learning-progress data stored with Supabase.</p>
            <p><strong>Data Retention on Deletion:</strong> When you delete your account, we retain your data for 30 days before permanent deletion (unless you request immediate deletion). See Privacy Policy Section 9 for details.</p>
          </section>

          <section>
            <h2>7. Third-Party Services</h2>
            <p>Langey uses third-party services that may have their own terms:</p>
            <ul>
              <li><strong>Google OAuth:</strong> Used for authentication. Subject to Google's Terms of Service</li>
              <li><strong>Google AI Services (Gemini API / Google Cloud Vertex AI):</strong> Used to generate AI-powered learning responses. Subject to Google's applicable product terms</li>
              <li><strong>Supabase:</strong> Database provider. Subject to Supabase's Terms of Service</li>
            </ul>
            <p>We are not responsible for these third parties' practices or outages. If these services become unavailable, Langey may not function properly.</p>
          </section>

          <section>
            <h2>8. Limitation of Liability</h2>
            <p><strong>Service Availability:</strong> Langey is provided "as-is" without warranty. We do not guarantee:</p>
            <ul>
              <li>Uninterrupted or error-free service</li>
              <li>Accuracy of learning content or answers</li>
              <li>Recovery of data in case of loss or corruption</li>
              <li>Specific learning outcomes or language proficiency</li>
            </ul>
            <p><strong>No Liability For:</strong> We are not liable for:</p>
            <ul>
              <li>Data loss, corruption, or unauthorized access (within limits of our reasonable security practices)</li>
              <li>Service interruptions, outages, or performance issues</li>
              <li>Third-party service failures (Google or Supabase)</li>
              <li>Indirect, incidental, or consequential damages</li>
              <li>Loss of profits, revenue, or data</li>
            </ul>
            <p><strong>Limitation Cap:</strong> In no event shall Langey be liable for more than the amount you paid us in the past 12 months (or €50, whichever is greater).</p>
            <p><strong>GDPR Exception:</strong> Nothing in these Terms limits your rights under the General Data Protection Regulation (GDPR) or applicable consumer protection laws.</p>
          </section>

          <section>
            <h2>9. Disclaimers</h2>
            <p><strong>No Warranty:</strong> THE SERVICE IS PROVIDED "AS-IS" AND "AS-AVAILABLE" WITHOUT ANY WARRANTIES, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, OR NON-INFRINGEMENT.</p>
            <p><strong>Not Professional Advice:</strong> Langey is an educational tool, not professional language instruction. Results depend on individual effort and practice. We do not guarantee language proficiency or exam success.</p>
            <p><strong>AI-Generated Content:</strong> Some features use generative AI. AI output can be incorrect, incomplete, or outdated, and may vary between requests. You are responsible for reviewing generated content before relying on it.</p>
            <p><strong>Educational Use Only:</strong> Content on Langey is for learning purposes only. We are not responsible for how you use the knowledge gained.</p>
          </section>

          <section>
            <h2>10. Acceptable Use Policy</h2>
            <p>You agree not to use Langey for:</p>
            <ul>
              <li>Illegal activities or violations of local/international laws</li>
              <li>Fraud, hacking, or unauthorized access</li>
              <li>Distributing malware, viruses, or harmful code</li>
              <li>Harassment, bullying, or defamation of others</li>
              <li>Spamming or excessive automated requests</li>
              <li>Impersonating others or misrepresenting your identity</li>
              <li>Accessing others' accounts without permission</li>
            </ul>
            <p><strong>Enforcement:</strong> Violations may result in immediate account suspension or termination without refund, and we may report illegal activity to authorities.</p>
          </section>

          <section>
            <h2>11. Changes to Terms & Service</h2>
            <p><strong>Updates:</strong> We may update these Terms at any time. Significant changes will be announced via email or prominent notice on our website.</p>
            <p><strong>Continued Use:</strong> Your continued use of Langey after updates means you accept the new Terms. If you disagree, you must stop using the Service.</p>
            <p><strong>Service Changes:</strong> We reserve the right to modify, suspend, or discontinue features or the entire Service with reasonable notice (minimum 30 days, except for legal/security reasons).</p>
          </section>

          <section>
            <h2>12. Termination</h2>
            <p><strong>By You:</strong> You can terminate your account anytime by contacting us at <a href="mailto:info@langey.com">info@langey.com</a>. We will delete your data per the Privacy Policy (30-day grace period).</p>
            <p><strong>By Us:</strong> We may terminate your account or access immediately if:</p>
            <ul>
              <li>You violate these Terms or applicable laws</li>
              <li>You engage in fraud, abuse, or harassment</li>
              <li>Payment is declined and not resolved within 7 days</li>
              <li>We discontinue the Service</li>
            </ul>
            <p><strong>Post-Termination:</strong> Upon termination, your right to use Langey ends. Data is handled per the Privacy Policy.</p>
          </section>

          <section>
            <h2>13. Jurisdiction & Dispute Resolution</h2>
            <p><strong>Governing Law:</strong> These Terms are governed by the laws of Ireland and the European Union, without regard to conflict-of-law provisions.</p>
            <p><strong>Jurisdiction:</strong> You irrevocably submit to the exclusive jurisdiction of the courts of Ireland for any legal proceedings arising from these Terms.</p>
            <p><strong>Dispute Resolution:</strong> Before litigation, we encourage you to contact us at <a href="mailto:info@langey.com">info@langey.com</a> to resolve disputes amicably.</p>
            <p><strong>EU Consumers:</strong> If you are an EU consumer, you may have additional rights under consumer protection laws, including access to alternative dispute resolution (ADR) mechanisms.</p>
          </section>

          <section>
            <h2>14. Contact Us</h2>
            <p>For questions, disputes, or to exercise any rights under these Terms:</p>
            <ul>
              <li><strong>Email:</strong> <a href="mailto:info@langey.com">info@langey.com</a></li>
              <li><strong>Response Time:</strong> We aim to respond within 30 days</li>
            </ul>
          </section>

          <section>
            <h2>15. Entire Agreement</h2>
            <p>These Terms, together with our Privacy Policy, constitute the entire agreement between you and Langey. If any provision is found unenforceable, the remaining provisions remain valid. Our failure to enforce any right does not constitute waiver of that right.</p>
          </section>
        </div>
      </div>
    </div>
  );
};
