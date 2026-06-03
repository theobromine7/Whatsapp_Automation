import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Privacy() {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <Link href="/settings">
          <Button variant="ghost" size="sm" className="gap-2 mb-6 -ml-2">
            <ArrowLeft className="w-4 h-4" />
            Back to Settings
          </Button>
        </Link>

        <div className="prose prose-sm max-w-none space-y-6 text-foreground">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Privacy Policy for Wapp</h1>
            <p className="text-muted-foreground text-sm mt-1">Last Updated: June 2026</p>
          </div>

          <Section title="1. Introduction">
            Wapp ("we," "our," "us") is a WhatsApp automation, broadcasting, customer engagement, and AI communication platform operated by Advize Technology. This Privacy Policy explains how we collect, use, store, process, and protect your information when you use Wapp and related Advize Technology services.
            <br /><br />
            By using Wapp, you consent to the practices described in this Privacy Policy.
          </Section>

          <Section title="2. Information We Collect">
            <strong>Account Information:</strong> When you register for Wapp, we may collect full name, email address, mobile number, business name, business address, profile information, and login credentials.
            <br /><br />
            <strong>Business Data:</strong> We may collect customer contact information uploaded by users, customer communication records, broadcast campaigns, automation workflows, message templates, AI configuration settings, and customer interaction history.
            <br /><br />
            <strong>Technical Information:</strong> We may automatically collect device information, browser information, IP address, operating system, log files, usage analytics, and session information.
          </Section>

          <Section title="3. Advize Ecosystem Integration">
            Wapp operates within the Advize Technology ecosystem. By creating an account, your account may be shared across Advize-operated platforms. Single Sign-On (SSO) may allow access to multiple Advize services using the same credentials. Basic account information may be accessible across Advize products for authentication, account management, support, and service improvement purposes.
          </Section>

          <Section title="4. WhatsApp Connectivity Data">
            <strong>Official WhatsApp API Connections:</strong> We may process business account identifiers, template data, message delivery status, and customer conversation metadata.
            <br /><br />
            <strong>QR-Based Connections:</strong> For QR-based WhatsApp Web connections using technologies such as Baileys, we may process session authentication data, device pairing information, and connection status information.
            <br /><br />
            Wapp does not claim ownership of your WhatsApp account, messages, or contacts.
          </Section>

          <Section title="5. How We Use Information">
            We may use information to provide platform functionality, enable automation features, deliver AI-powered responses, process broadcasts and campaigns, improve service performance, prevent abuse and fraud, provide customer support, generate analytics and reports, and comply with legal obligations.
          </Section>

          <Section title="6. AI Features">
            When AI features are enabled, customer messages may be processed by AI systems, business knowledge bases may be analyzed to generate responses, and AI-generated content may be stored to improve workflow functionality. Users remain responsible for reviewing AI-generated outputs before relying on them for critical business decisions.
          </Section>

          <Section title="7. Data Sharing">
            We do not sell your personal information. We may share information with cloud infrastructure providers, authentication providers, analytics providers, AI service providers, payment processors, and legal authorities when required by law. All third-party providers are expected to maintain appropriate security and confidentiality measures.
          </Section>

          <Section title="8. Data Retention">
            We retain information for as long as necessary to provide services, maintain account functionality, resolve disputes, enforce agreements, and meet legal obligations. Users may request account deletion, subject to applicable legal and operational requirements.
          </Section>

          <Section title="9. Security Measures">
            Wapp implements reasonable security measures including encrypted communications, access controls, authentication safeguards, monitoring systems, and infrastructure security practices. However, no online service can guarantee complete security. Users are responsible for maintaining secure passwords and protecting account access.
          </Section>

          <Section title="10. User Responsibilities">
            Users are responsible for obtaining proper customer consent, complying with applicable privacy laws, protecting customer information, and using the platform lawfully. Wapp is not responsible for user misuse of customer data.
          </Section>

          <Section title="11. Cookies and Analytics">
            We may use cookies and similar technologies to maintain user sessions, improve performance, analyze platform usage, and enhance user experience. Users may manage certain cookie preferences through their browser settings.
          </Section>

          <Section title="12. Children's Privacy">
            Wapp is intended for business users and is not directed toward individuals under the age of 18. We do not knowingly collect personal information from children.
          </Section>

          <Section title="13. International Data Processing">
            Your information may be processed and stored on servers located in different jurisdictions depending on service providers and infrastructure requirements. By using Wapp, you consent to such processing and transfers.
          </Section>

          <Section title="14. Your Rights">
            Subject to applicable laws, you may have the right to access your information, correct inaccurate information, request deletion of information, request data portability, and withdraw certain consents. Requests may be submitted through our support channels.
          </Section>

          <Section title="15. Changes to this Privacy Policy">
            We may update this Privacy Policy periodically. Updated versions will be published on the Wapp website or application. Continued use of the Service after updates constitutes acceptance of the revised policy.
          </Section>

          <Section title="16. Contact Us">
            For privacy-related questions, requests, or concerns, contact Advize Technology at{" "}
            <a href="mailto:contact@advize.in" className="text-primary underline">contact@advize.in</a>.
          </Section>

          <p className="text-xs text-muted-foreground border-t pt-4">
            By using Wapp, you acknowledge that you have read and understood this Privacy Policy.
          </p>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h2 className="text-base font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground leading-relaxed">{children}</p>
    </div>
  );
}
