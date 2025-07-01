/**
 * Shared interfaces for Content Marketing Agent Swarm
 */

import type { JsonObject, JsonPrimitive } from "@agentuity/sdk";
import { z } from 'zod';

export interface ExploratoryCustomerInterview {
    id: string;
    localRecordingUrl?: string;
    recordingUrl?: string;
    metadata: InterviewMetadata;
    
    marketInsights?: MarketInsights;
  
    painPoints?: Array<PainPoint>;
  
    productNeedsAndDesires?: Array<ProductNeed>;
  
    productFeedback?: ProductFeedback;
  
    topicsDiscussed?: string[];
  
    transcript?: string;

    sections?: InterviewSection[];
  
    insightsSummary?: InsightsSummary;
  
    followUp?: FollowUp;

    createdAt: string;
    updatedAt: string;
  }
  
export interface InterviewSection {
    /** Short title summarizing the main theme (e.g., "Product Feedback", "User Journey") */
    title: string;

    /** 2–3 sentence overview/summary of what this section of the conversation is about */
    description: string;

    /** A concise summary (1–3 sentences) of the context around this section in regards to the entire interview*/
    context: string;

    /** Key insights or implications from this section, phrased as actionable or directional ideas */
    potentialTakeaways: string[];

    /** 1–5 direct quotes from the customer that support the section's summary or theme */
    customerQuotes: CustomerQuote[];

    /** Optional start and end indices or timestamps from the transcript for traceability */
    sourceReference?: {
        startTime?: string; // e.g., "00:12:45"
    };
}

export interface CustomerQuote {
    /** Verbatim quote from the customer */
    quote: string;

    /** Optional tag (e.g., "frustration", "insight", "positive feedback") */
    sentimentTag?: 'positive' | 'negative' | 'neutral';

    /** Optional context, e.g., speaker role or where in the interview it appeared */
    context?: string;
}

export interface Payload<Data extends JsonPrimitive> extends JsonObject {
    pageId: string | null;
    data: Data | null;
}

export interface InterviewMetadata {
    interviewDate: string; // ISO string
    customerName: string;
    customerLinkedInUrl?: string;
    customerTitle?: string;
    interviewer?: string;
    customerCompany?: CustomerCompany;
    recordingUrl?: string;
}

export interface CustomerCompany {
    name: string;
    companyOverview?: string;
    teamStructure?: string;
    relevantRoles?: string[]; // e.g., ['DevOps Engineer', 'CTO']
}

export interface MarketInsights {
    industry: string;
    marketTrendsMentioned: string[];
    competitiveLandscape: string[];
    regulatoryOrComplianceFactors?: string[];
}

export interface PainPoint {
    area: string; // e.g., "Testing", "Onboarding", "Monitoring"
    description: string;
    currentWorkaround?: string;
    impactLevel: 'low' | 'medium' | 'high';
}

export interface ProductNeed {
    needDescription: string;
    useCase?: string;
    importance: 'must-have' | 'nice-to-have';
    relatedPainPoint?: string;
}

export interface ProductFeedback {
    featuresLiked?: string[];
    featuresDisliked?: string[];
    missingCapabilities?: string[];
    suggestions?: string[];
    directQuotes?: Array<{
        quote: string;
        topic?: string;
    }>;
}

export interface UserJourney {
    currentWorkflow: string;
    stages: Array<{
        stageName: string;
        description: string;
        painPoints?: string[];
    }>;
}

export interface InsightsSummary {
    keyTakeaways: string[];
    patternsObserved?: string[];
    quotesToHighlight?: string[];
    recommendedActions?: string[];
}

export interface FollowUp {
    internalOwner: string;
    nextSteps: string;
}

export const InterviewSectionsSchema = z.object({
    sections: z.array(
        z.object({
            title: z.string(),
            description: z.string(),
            context: z.string(),
            potentialTakeaways: z.array(z.string()),
            customerQuotes: z.array(
                z.object({
                    quote: z.string(),
                    sentimentTag: z.enum(['positive', 'negative', 'neutral']).optional(),
                    context: z.string().optional()
                })
            ),
            sourceReference: z.object({
                startTime: z.string().optional(),
            }).optional()
        })
    )
});

export type InterviewSections = z.infer<typeof InterviewSectionsSchema>;

export const InterviewMetadataSchema = z.object({
    interviewDate: z.string(), // ISO string
    customerName: z.string(),
    customerLinkedInUrl: z.string().optional(),
    customerTitle: z.string().optional(),
    interviewer: z.string().optional(),
    customerCompany: z.object({
        name: z.string(),
        companyOverview: z.string().optional(),
        teamStructure: z.string().optional(),
        relevantRoles: z.array(z.string()).optional(), // e.g., ['DevOps Engineer', 'CTO']
    }).optional(),
    recordingUrl: z.string().optional()
});

export type InterviewMetadataSchemaType = z.infer<typeof InterviewMetadataSchema>;
