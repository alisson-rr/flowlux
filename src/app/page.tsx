import Navbar from "@/components/landing/Navbar";
import HeroSection from "@/components/landing/HeroSection";
import PainSection from "@/components/landing/PainSection";
import HowItWorksSection from "@/components/landing/HowItWorksSection";
import ComparisonSection from "@/components/landing/ComparisonSection";
import ModulesSection from "@/components/landing/ModulesSection";
import PricingSection from "@/components/landing/PricingSection";
import FAQSection from "@/components/landing/FAQSection";
import ClosingSection from "@/components/landing/ClosingSection";
import FooterSection from "@/components/landing/FooterSection";
import WhatsAppButton from "@/components/landing/WhatsAppButton";

export default function Home() {
  return (
    <div className="flowup-landing min-h-screen bg-background text-foreground">
      <Navbar />
      <HeroSection />
      <PainSection />
      <HowItWorksSection />
      <ComparisonSection />
      <ModulesSection />
      <PricingSection />
      <FAQSection />
      <ClosingSection />
      <FooterSection />
      <WhatsAppButton />
    </div>
  );
}
