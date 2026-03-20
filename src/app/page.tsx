import Navbar from "@/components/landing/Navbar";
import HeroSection from "@/components/landing/HeroSection";
import PainSection from "@/components/landing/PainSection";
import SolutionSection from "@/components/landing/SolutionSection";
import BenefitsSection from "@/components/landing/BenefitsSection";
import ProductSection from "@/components/landing/ProductSection";
import FeaturesSection from "@/components/landing/FeaturesSection";
import DifferentiatorSection from "@/components/landing/DifferentiatorSection";
import AudienceSection from "@/components/landing/AudienceSection";
import PricingSection from "@/components/landing/PricingSection";
import CommunitySection from "@/components/landing/CommunitySection";
import FAQSection from "@/components/landing/FAQSection";
import ClosingSection from "@/components/landing/ClosingSection";
import FooterSection from "@/components/landing/FooterSection";
import WhatsAppButton from "@/components/landing/WhatsAppButton";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <HeroSection />
      <PainSection />
      <SolutionSection />
      <BenefitsSection />
      <ProductSection />
      <FeaturesSection />
      <DifferentiatorSection />
      <AudienceSection />
      <PricingSection />
      <CommunitySection />
      <FAQSection />
      <ClosingSection />
      <FooterSection />
      <WhatsAppButton />
    </div>
  );
}
