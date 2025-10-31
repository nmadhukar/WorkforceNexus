
import { ReactNode, useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, ArrowRight, ChevronLeft, ChevronRight, CheckCircle2, AlertCircle, Badge } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from "@/components/ui/tooltip";

interface Step {
  title: string;
  component: ReactNode;
}

interface MultiStepFormProps {
  steps: Step[];
  currentStep: number;
  onNext: () => void;
  onPrevious: () => void;
  onSubmit: () => void;
  isSubmitting: boolean;
  canNext: boolean;
  canProceed?: boolean;
  proceedBlockedMessage?: string;
  isOnboarding?: boolean;
}

export function MultiStepForm({
  steps,
  currentStep,
  onNext,
  onPrevious,
  onSubmit,
  isSubmitting,
  canNext,
  canProceed,
  proceedBlockedMessage,
  isOnboarding
}: MultiStepFormProps) {
  const progressPercentage = (currentStep / steps.length) * 100;
  const isLastStep = currentStep === steps.length;
  const isFirstStep = currentStep === 1;
  const [isMobile, setIsMobile] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Determine if the Next button should be disabled
  const isNextDisabled = canProceed !== undefined ? !canProceed : !canNext;
  const nextButtonTooltip = proceedBlockedMessage || "Please complete all required fields before proceeding";

  useEffect(() => {
    const checkScreenSize = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkScreenSize();
    window.addEventListener('resize', checkScreenSize);
    return () => window.removeEventListener('resize', checkScreenSize);
  }, []);

  // Scroll to active step when it changes
  useEffect(() => {
    if (scrollRef.current) {
      const activeElement = scrollRef.current.querySelector(`[data-step="${currentStep}"]`);
      if (activeElement) {
        activeElement.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [currentStep]);

  return (
    <div className="max-w-full space-y-6">
      {/* Enhanced Progress Indicator Card */}
      { 
        !isOnboarding ? (
          <Card className="overflow-hidden border-0 shadow-sm bg-gradient-to-br from-card to-muted/20">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h2 className="text-lg font-semibold text-foreground">
                    Step {currentStep} of {steps.length}
                  </h2>
                  <p className="text-sm text-muted-foreground">
                    {steps[currentStep - 1].title}
                  </p>
                </div>
                <div className="text-2xl font-bold text-primary">
                  {Math.round(progressPercentage)}%
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0 pb-6">
              <div className="space-y-4">
                {/* Progress Bar */}
                <Progress value={progressPercentage} className="h-2" />

                {/* Step Navigation - Compact & Scrollable */}
                {isMobile ? (
                  /* Mobile: Vertical Stack */
                  <ScrollArea className="h-32 w-full rounded-md">
                    <div className="space-y-2 p-2">
                      {steps.map((step, index) => {
                        const stepNumber = index + 1;
                        const isActive = stepNumber === currentStep;
                        const isCompleted = stepNumber < currentStep;

                        return (
                          <div
                            key={stepNumber}
                            data-step={stepNumber}
                            data-testid={`step-chip-mobile-${stepNumber}`}
                            className={cn(
                              "flex items-center gap-3 p-2 rounded-lg transition-all",
                              isActive && "bg-primary/10 border border-primary/20",
                              !isActive && !isCompleted && "opacity-60"
                            )}
                          >
                            <div
                              className={cn(
                                "flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-medium transition-all",
                                isActive && "bg-primary text-primary-foreground shadow-md",
                                isCompleted && "bg-secondary text-secondary-foreground",
                                !isActive && !isCompleted && "bg-muted text-muted-foreground"
                              )}
                            >
                              {isCompleted ? (
                                <CheckCircle2 className="w-4 h-4" />
                              ) : (
                                stepNumber
                              )}
                            </div>
                            <span
                              className={cn(
                                "text-sm font-medium flex-1",
                                isActive ? "text-foreground" : "text-muted-foreground"
                              )}
                            >
                              {step.title}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </ScrollArea>
                ) : (
                  /* Desktop: Horizontal Scrollable */
                  <div className="relative">
                    <ScrollArea className="w-full">
                      <div className="flex items-center gap-2 pb-2" ref={scrollRef}>
                        {steps.map((step, index) => {
                          const stepNumber = index + 1;
                          const isActive = stepNumber === currentStep;
                          const isCompleted = stepNumber < currentStep;

                          return (
                            <div
                              key={stepNumber}
                              data-step={stepNumber}
                              className="flex items-center"
                            >
                              <button
                                type="button"
                                data-testid={`step-chip-${stepNumber}`}
                                onClick={() => {
                                  if (stepNumber < currentStep) {
                                    // Allow navigation to previous completed steps
                                    for (let i = currentStep; i > stepNumber; i--) {
                                      onPrevious();
                                    }
                                  }
                                }}
                                disabled={stepNumber >= currentStep}
                                className={cn(
                                  "flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all whitespace-nowrap",
                                  isActive && "bg-primary/10 border border-primary/20",
                                  isCompleted && "hover:bg-muted cursor-pointer",
                                  !isActive && !isCompleted && "opacity-60 cursor-not-allowed"
                                )}
                              >
                                <div
                                  className={cn(
                                    "flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium transition-all",
                                    isActive && "bg-primary text-primary-foreground shadow-md",
                                    isCompleted && "bg-secondary text-secondary-foreground",
                                    !isActive && !isCompleted && "bg-muted text-muted-foreground"
                                  )}
                                  data-testid={`step-indicator-${stepNumber}`}
                                >
                                  {isCompleted ? (
                                    <CheckCircle2 className="w-3 h-3" />
                                  ) : (
                                    stepNumber
                                  )}
                                </div>
                                <span
                                  className={cn(
                                    "text-xs font-medium hidden lg:inline",
                                    isActive ? "text-foreground" : "text-muted-foreground"
                                  )}
                                >
                                  {step.title}
                                </span>
                              </button>
                              {index < steps.length - 1 && (
                                <div className="w-8 h-px bg-border mx-1" />
                              )}
                            </div>
                          );
                        })}
                      </div>
                      <ScrollBar orientation="horizontal" />
                    </ScrollArea>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ) : (
          /* Onboarding Progress Indicator */
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Step {currentStep} of 12</span>
                <span className="text-sm text-muted-foreground">{Math.round((currentStep / 12) * 100)}% Complete</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-primary h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(currentStep / 12) * 100}%` }}
                />
              </div>
              <div className="mt-4 flex items-center justify-between">
                <h3 className="font-semibold">{steps[currentStep - 1].title}</h3>
                {/* {existingOnboarding && (
                  <Badge variant="outline">Draft Available</Badge>
                )} */}
              </div>
            </CardContent>
          </Card>)}

      {/* Current Step Content with Enhanced Styling */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="border-b bg-gradient-to-r from-primary/5 to-transparent">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-semibold text-foreground">
                {steps[currentStep - 1].title}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                Please fill in the required information below
              </p>
            </div>
            {/* Quick Navigation for Desktop */}
            <div className="hidden md:flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={onPrevious}
                disabled={isFirstStep}
                className="h-8 px-2"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm text-muted-foreground px-2">
                {currentStep} / {steps.length}
              </span>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span tabIndex={0}>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={onNext}
                        disabled={isLastStep || isNextDisabled}
                        className="h-8 px-2"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </Button>
                    </span>
                  </TooltipTrigger>
                  {isNextDisabled && !isLastStep && (
                    <TooltipContent>
                      <p>{nextButtonTooltip}</p>
                    </TooltipContent>
                  )}
                </Tooltip>
              </TooltipProvider>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="space-y-6">
            {/* Form Content */}
            <div className="min-h-[400px]">
              {steps[currentStep - 1].component}
            </div>

            {/* Enhanced Navigation Buttons */}
            <div className="flex flex-col sm:flex-row gap-3 sm:justify-between pt-6 border-t border-border">
              <Button
                variant="outline"
                onClick={onPrevious}
                disabled={isFirstStep}
                data-testid="button-previous"
                className="w-full sm:w-auto"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Previous
              </Button>

              <div className="flex gap-3 w-full sm:w-auto">
                {isLastStep ? (
                  <>
                    <Button
                      variant="outline"
                      onClick={onPrevious}
                      className="flex-1 sm:flex-initial"
                    >
                      Review
                    </Button>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span tabIndex={0}>
                            <Button
                              onClick={onSubmit}
                              disabled={isSubmitting || isNextDisabled}
                              data-testid="button-submit"
                              className="flex-1 sm:flex-initial bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-md"
                            >
                              {isSubmitting ? (
                                <>
                                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                                  Submitting...
                                </>
                              ) : (
                                "Complete & Submit"
                              )}
                            </Button>
                          </span>
                        </TooltipTrigger>
                        {isNextDisabled && !isSubmitting && (
                          <TooltipContent>
                            <p>{nextButtonTooltip}</p>
                          </TooltipContent>
                        )}
                      </Tooltip>
                    </TooltipProvider>
                  </>
                ) : (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span tabIndex={0}>
                          <Button
                            onClick={onNext}
                            disabled={isNextDisabled}
                            data-testid="button-next"
                            className={cn(
                              "flex-1 sm:flex-initial",
                              isNextDisabled && proceedBlockedMessage && "relative"
                            )}
                          >
                            {isNextDisabled && proceedBlockedMessage && (
                              <AlertCircle className="w-4 h-4 mr-2" />
                            )}
                            Next Step
                            <ArrowRight className="w-4 h-4 ml-2" />
                          </Button>
                        </span>
                      </TooltipTrigger>
                      {isNextDisabled && (
                        <TooltipContent className="max-w-xs">
                          <div className="flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                            <p className="text-sm">{nextButtonTooltip}</p>
                          </div>
                        </TooltipContent>
                      )}
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}