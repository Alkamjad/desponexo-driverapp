import React, { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { 
  Truck, Package, CheckCircle, MapPin, FileText, 
  Euro, ChevronRight, X 
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { t } from "@/components/utils/i18n";

const getTutorialSteps = () => [
  {
    icon: Truck,
    title: t('tutorial_welcome_title'),
    description: t('tutorial_welcome_desc'),
    color: "emerald"
  },
  {
    icon: Package,
    title: t('tutorial_tours_title'),
    description: t('tutorial_tours_desc'),
    color: "blue"
  },
  {
    icon: MapPin,
    title: t('tutorial_nav_title'),
    description: t('tutorial_nav_desc'),
    color: "purple"
  },
  {
    icon: FileText,
    title: t('tutorial_delivery_title'),
    description: t('tutorial_delivery_desc'),
    color: "orange"
  },
  {
    icon: Euro,
    title: t('tutorial_billing_title'),
    description: t('tutorial_billing_desc'),
    color: "green"
  },
  {
    icon: CheckCircle,
    title: t('tutorial_ready_title'),
    description: t('tutorial_ready_desc'),
    color: "emerald"
  }
];

export default function OnboardingTutorial({ onComplete }) {
  const [currentStep, setCurrentStep] = useState(0);
  const [isOpen, setIsOpen] = useState(true);
  
  const TUTORIAL_STEPS = getTutorialSteps();
  const step = TUTORIAL_STEPS[currentStep];
  const Icon = step.icon;
  const isLastStep = currentStep === TUTORIAL_STEPS.length - 1;

  const colorClasses = {
    emerald: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
    blue: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    purple: "bg-purple-500/20 text-purple-400 border-purple-500/30",
    orange: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    green: "bg-green-500/20 text-green-400 border-green-500/30"
  };

  const handleNext = () => {
    if (isLastStep) {
      handleComplete();
    } else {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleSkip = () => {
    handleComplete();
  };

  const handleComplete = () => {
    localStorage.setItem('tutorial_completed', 'true');
    setIsOpen(false);
    onComplete?.();
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-md">
        <div className="relative">
          {/* Skip Button */}
          {!isLastStep && (
            <button
              onClick={handleSkip}
              className="absolute -top-2 -right-2 w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center transition-colors"
            >
              <X className="w-4 h-4 text-slate-400" />
            </button>
          )}

          {/* Content */}
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3 }}
              className="py-6"
            >
              {/* Icon */}
              <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 border ${colorClasses[step.color]}`}>
                <Icon className="w-10 h-10" />
              </div>

              {/* Title */}
              <h2 className="text-2xl font-bold text-center mb-3">
                {step.title}
              </h2>

              {/* Description */}
              <p className="text-slate-400 text-center mb-8 leading-relaxed">
                {step.description}
              </p>

              {/* Progress Dots */}
              <div className="flex justify-center gap-2 mb-6">
                {TUTORIAL_STEPS.map((_, index) => (
                  <div
                    key={index}
                    className={`h-2 rounded-full transition-all ${
                      index === currentStep 
                        ? 'w-8 bg-emerald-500' 
                        : index < currentStep
                        ? 'w-2 bg-emerald-500/50'
                        : 'w-2 bg-slate-700'
                    }`}
                  />
                ))}
              </div>

              {/* Action Button */}
              <Button
                onClick={handleNext}
                className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
              >
                {isLastStep ? (
                  t('tutorial_start')
                ) : (
                  <>
                    {t('tutorial_next')}
                    <ChevronRight className="w-5 h-5 ml-2" />
                  </>
                )}
              </Button>

              {/* Step Counter */}
              <p className="text-center text-slate-500 text-sm mt-4">
                {t('tutorial_step')} {currentStep + 1} / {TUTORIAL_STEPS.length}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}