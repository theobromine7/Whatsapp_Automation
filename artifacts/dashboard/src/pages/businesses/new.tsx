import { useState } from "react";
import { Link, useLocation } from "wouter";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useCreateBusiness, getListBusinessesQueryKey } from "@workspace/api-client-react";
import {
  ArrowLeft,
  ArrowRight,
  Building,
  CheckCircle2,
  MessageSquareText,
  Loader2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const step1Schema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  businessType: z.string().min(2, "Business type is required."),
  description: z.string().min(10, "Description must be at least 10 characters."),
});

const step2Schema = z.object({
  systemPrompt: z.string().min(10, "System prompt must be at least 10 characters."),
  products: z.string().optional(),
  faqs: z.string().optional(),
});

type Step1Values = z.infer<typeof step1Schema>;
type Step2Values = z.infer<typeof step2Schema>;

const STEPS = [
  { label: "Business Info", icon: Building },
  { label: "AI Setup", icon: MessageSquareText },
];

export default function NewBusiness() {
  const [step, setStep] = useState<1 | 2>(1);
  const [formData, setFormData] = useState<Partial<Step1Values>>({});
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const createBusiness = useCreateBusiness();

  const form1 = useForm<Step1Values>({
    resolver: zodResolver(step1Schema),
    defaultValues: { name: "", businessType: "", description: "" },
  });

  const form2 = useForm<Step2Values>({
    resolver: zodResolver(step2Schema),
    defaultValues: {
      systemPrompt:
        "You are a helpful and friendly sales assistant for this business. Your goal is to answer customer questions accurately, highlight product benefits, and guide them towards making a purchase or booking. Keep responses concise and conversational — plain text only, no markdown.",
      products: "",
      faqs: "",
    },
  });

  const onStep1Submit = (data: Step1Values) => {
    setFormData(data);
    setStep(2);
  };

  const onStep2Submit = (data: Step2Values) => {
    const finalData = { ...formData, ...data };
    createBusiness.mutate(
      { data: finalData as Parameters<typeof createBusiness.mutate>[0]["data"] },
      {
        onSuccess: (res) => {
          queryClient.invalidateQueries({ queryKey: getListBusinessesQueryKey() });
          toast({
            title: "Business created",
            description: "Now connect your WhatsApp number to go live.",
          });
          setLocation(`/businesses/${res.id}`);
        },
        onError: () => {
          toast({ title: "Failed", description: "Could not create business. Try again.", variant: "destructive" });
        },
      }
    );
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center gap-4">
        <Link href="/">
          <Button variant="outline" size="icon" className="shrink-0" data-testid="button-back">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Add Business</h1>
          <p className="text-muted-foreground text-sm">
            Set up your business profile and AI agent. Connect WhatsApp after.
          </p>
        </div>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((s, i) => {
          const num = i + 1;
          const isActive = step === num;
          const isDone = step > num;
          return (
            <div key={s.label} className="flex items-center gap-2 flex-1 min-w-0">
              <div className={cn("flex items-center gap-2 shrink-0", !isActive && !isDone ? "text-muted-foreground" : "text-primary")}>
                <div className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold border-2",
                  isDone ? "bg-primary border-primary text-primary-foreground"
                    : isActive ? "border-primary text-primary bg-primary/10"
                    : "border-border text-muted-foreground"
                )}>
                  {isDone ? <CheckCircle2 className="w-4 h-4" /> : num}
                </div>
                <span className={cn("text-sm font-medium hidden sm:block", !isActive && !isDone && "text-muted-foreground")}>
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div className={cn("h-px flex-1 mx-2", isDone ? "bg-primary" : "bg-border")} />
              )}
            </div>
          );
        })}
      </div>

      {step === 1 && (
        <Card className="animate-in slide-in-from-right-4 duration-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building className="w-4 h-4 text-primary" /> Business Details
            </CardTitle>
            <CardDescription>Basic information about the business.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form1}>
              <form id="form-step-1" onSubmit={form1.handleSubmit(onStep1Submit)} className="space-y-4">
                <FormField control={form1.control} name="name" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Business Name</FormLabel>
                    <FormControl><Input placeholder="Green Leaf Bakery" data-testid="input-name" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form1.control} name="businessType" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Business Type</FormLabel>
                    <FormControl><Input placeholder="e.g. Bakery, Salon, Clinic, Retail" data-testid="input-type" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form1.control} name="description" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Describe what your business does, your location, and hours..."
                        className="min-h-[90px]"
                        data-testid="textarea-description"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )} />
              </form>
            </Form>
          </CardContent>
          <CardFooter className="justify-end border-t pt-4">
            <Button type="submit" form="form-step-1" data-testid="button-next">
              Continue <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </CardFooter>
        </Card>
      )}

      {step === 2 && (
        <Card className="animate-in slide-in-from-right-4 duration-300">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <MessageSquareText className="w-4 h-4 text-primary" /> AI Agent Setup
            </CardTitle>
            <CardDescription>
              Tell the AI about your business so it can answer customers accurately.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form2}>
              <form id="form-step-2" onSubmit={form2.handleSubmit(onStep2Submit)} className="space-y-4">
                <FormField control={form2.control} name="systemPrompt" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Agent Instructions</FormLabel>
                    <FormControl>
                      <Textarea
                        className="min-h-[120px] font-mono text-sm"
                        data-testid="textarea-prompt"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription className="text-xs">
                      Defines tone and rules for the AI. Be specific about what it should and should not do.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form2.control} name="products" render={({ field }) => (
                  <FormItem>
                    <FormLabel>Products & Services <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={"Burger - ₹150\nPizza Margherita - ₹280\nLemonade - ₹60"}
                        className="min-h-[80px]"
                        data-testid="textarea-products"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription className="text-xs">Products, prices, and key details.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />
                <FormField control={form2.control} name="faqs" render={({ field }) => (
                  <FormItem>
                    <FormLabel>FAQs <span className="text-muted-foreground font-normal">(optional)</span></FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={"Q: Do you deliver?\nA: Yes, within 5km.\n\nQ: What are your hours?\nA: 9am–10pm daily."}
                        className="min-h-[80px]"
                        data-testid="textarea-faqs"
                        {...field}
                      />
                    </FormControl>
                    <FormDescription className="text-xs">Common questions the AI should answer accurately.</FormDescription>
                    <FormMessage />
                  </FormItem>
                )} />
              </form>
            </Form>
          </CardContent>
          <CardFooter className="justify-between border-t pt-4">
            <Button variant="ghost" onClick={() => setStep(1)} data-testid="button-back-step2">Back</Button>
            <Button type="submit" form="form-step-2" disabled={createBusiness.isPending} data-testid="button-finish">
              {createBusiness.isPending ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating...</>
              ) : (
                <><CheckCircle2 className="w-4 h-4 mr-2" /> Create Business</>
              )}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Hint */}
      <p className="text-center text-xs text-muted-foreground">
        After creating, you'll connect your WhatsApp number by scanning a QR code — no developer account needed.
      </p>
    </div>
  );
}
