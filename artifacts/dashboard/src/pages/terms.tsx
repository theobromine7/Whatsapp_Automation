import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Terms() {
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
            <h1 className="text-2xl font-bold tracking-tight">Terms and Conditions for Wapp</h1>
            <p className="text-muted-foreground text-sm mt-1">Last Updated: June 2026</p>
          </div>

          <Section title="1. Acceptance of Terms">
            By accessing or using Wapp ("Service"), you agree to be bound by these Terms and Conditions. If you do not agree to these Terms, you must not use the Service.
            <br /><br />
            Wapp is a WhatsApp automation, customer engagement, broadcasting, and communication platform operated under the Advize ecosystem.
          </Section>

          <Section title="2. Description of Service">
            Wapp provides tools including but not limited to:
            <ul>
              <li>WhatsApp automation</li>
              <li>AI-powered customer support</li>
              <li>Customer engagement tools</li>
              <li>Message broadcasting</li>
              <li>Lead management</li>
              <li>Business communication workflows</li>
              <li>Analytics and reporting</li>
              <li>Integration with third-party services</li>
            </ul>
            Wapp may provide connectivity through Official WhatsApp Business Platform APIs, WhatsApp Business Solution Providers, or QR-based WhatsApp Web connections powered by third-party technologies including Baileys or similar technologies. Service availability and features may vary depending on the connection method selected.
          </Section>

          <Section title="3. Advize Ecosystem Account">
            Wapp operates within the Advize Technology infrastructure. By creating an account on Wapp, you become a user of the Advize Technology ecosystem. Your account credentials may be used across other Advize Technology products and services. Single Sign-On (SSO) functionality may allow access to multiple Advize-operated platforms using the same account credentials. Account information may be shared among Advize-owned products for authentication, security, account management, and service improvement purposes.
            <br /><br />
            Users are responsible for maintaining the confidentiality of their login credentials.
          </Section>

          <Section title="4. User Responsibilities">
            You agree to: provide accurate information; maintain the security of your account; comply with applicable laws and regulations; obtain necessary customer consent before sending messages; respect recipient privacy rights; and use the Service only for lawful business purposes.
            <br /><br />
            You are solely responsible for all content, messages, broadcasts, and communications sent through your account.
          </Section>

          <Section title="5. WhatsApp Compliance">
            Users must comply with WhatsApp Terms of Service, WhatsApp Business Policies, Meta Platform Policies, applicable anti-spam laws, and consumer protection regulations. Wapp does not control WhatsApp's policies and cannot guarantee continued WhatsApp account access. Any suspension, restriction, or termination imposed by WhatsApp or Meta remains the user's responsibility.
          </Section>

          <Section title="6. QR-Based Connections and Baileys Integrations">
            Certain features may use QR-code-based WhatsApp connections through technologies such as Baileys. Users acknowledge that such connections are not official WhatsApp Business API connections; WhatsApp may modify, limit, restrict, or discontinue support for such connection methods at any time; session interruptions may occur; and features may become unavailable due to changes made by WhatsApp. Wapp does not guarantee uninterrupted availability of QR-based connection methods.
          </Section>

          <Section title="7. Broadcasting and Messaging">
            Users must send messages only to recipients who have provided appropriate consent, avoid spam, phishing, harassment, scams, or deceptive practices, and honor opt-out requests promptly. Wapp reserves the right to suspend accounts engaging in abusive messaging behavior.
          </Section>

          <Section title="8. Artificial Intelligence Features">
            Wapp may provide AI-powered automation and response generation. Users acknowledge that AI-generated responses may contain inaccuracies, users remain responsible for reviewing automated workflows, and Wapp does not guarantee accuracy, completeness, or suitability of AI-generated content.
          </Section>

          <Section title="9. Data Storage and Security">
            Wapp implements reasonable security measures to protect user data. However, no system can guarantee absolute security. Users acknowledge and accept the inherent risks associated with internet-based services.
          </Section>

          <Section title="10. Service Availability">
            Wapp strives to maintain service availability but does not guarantee continuous uptime, error-free operation, or uninterrupted access. Maintenance, updates, third-party outages, or technical issues may affect service availability.
          </Section>

          <Section title="11. Payments and Subscriptions">
            Subscription fees, setup fees, and usage-based charges are payable according to the selected plan. Unless otherwise stated, payments are non-refundable, failure to pay may result in service suspension, and pricing may change with prior notice.
          </Section>

          <Section title="12. Intellectual Property">
            All software, branding, designs, technology, and content associated with Wapp and Advize remain the property of Advize and its licensors. Users receive a limited, non-exclusive, revocable license to use the Service.
          </Section>

          <Section title="13. Prohibited Activities">
            Users may not send spam or unsolicited bulk communications; violate WhatsApp policies; distribute malware; engage in fraud or deceptive practices; reverse engineer the platform; attempt unauthorized access to systems; or use the platform for illegal activities. Violation may result in immediate account suspension or termination.
          </Section>

          <Section title="14. Limitation of Liability">
            To the maximum extent permitted by law, Wapp, Advize, its owners, employees, affiliates, and partners shall not be liable for loss of profits, loss of customers, loss of business opportunities, service interruptions, data loss, third-party platform restrictions, or WhatsApp account suspensions. Use of the Service is at your own risk.
          </Section>

          <Section title="15. Indemnification">
            Users agree to indemnify and hold harmless Wapp and Advize from any claims, liabilities, damages, losses, or expenses arising from user conduct, user content, violation of these Terms, or violation of applicable laws or third-party rights.
          </Section>

          <Section title="16. Termination">
            Wapp may suspend or terminate access at any time if these Terms are violated, fraudulent activity is detected, platform abuse occurs, or legal or regulatory obligations require action.
          </Section>

          <Section title="17. Modifications">
            Wapp reserves the right to modify these Terms at any time. Continued use of the Service after modifications constitutes acceptance of the revised Terms.
          </Section>

          <Section title="18. Governing Law">
            These Terms shall be governed by and interpreted in accordance with the laws of India. Any disputes shall be subject to the exclusive jurisdiction of courts located in Uttar Pradesh, India.
          </Section>

          <Section title="19. Contact Information">
            For questions regarding these Terms, contact Advize Support at{" "}
            <a href="mailto:contact@advize.in" className="text-primary underline">contact@advize.in</a>.
          </Section>

          <p className="text-xs text-muted-foreground border-t pt-4">
            By using Wapp, you acknowledge that you have read, understood, and agreed to these Terms and Conditions.
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
