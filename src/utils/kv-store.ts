import type { AgentContext } from "@agentuity/sdk";
import type { ExploratoryCustomerInterview, InterviewSection } from "../types";

// Constants
const INTERVIEWS_STORE = "interviews";
const INTERVIEWS_INDEX_KEY = "interviews_index";
const INTERVIEWS_INDEX_STORE = "interviews_meta";
const INTERVIEWS_SECTIONS_STORE = "interviews_sections";

// Define the interview index structure
interface InterviewIndex {
	interviewIds: string[];
}

/**
 * Validates a interview ID
 */
function isValidId(id: unknown): id is string {
	return Boolean(id && typeof id === "string" && id.trim() !== "");
}

/**
 * Safe access to the interview index
 */
async function getInterviewIndex(ctx: AgentContext): Promise<string[]> {
	const result = await ctx.kv.get(INTERVIEWS_INDEX_STORE, INTERVIEWS_INDEX_KEY);

	// Type handling for the JSON data
	const indexData = result?.data?.json as unknown;
	const typedIndex = indexData as InterviewIndex | undefined;

	return typedIndex?.interviewIds?.filter(isValidId) || [];
}

/**
 * Updates the interview index with a new ID
 */
async function updateInterviewIndex(
	ctx: AgentContext,
	interviewId: string,
): Promise<void> {
	if (!isValidId(interviewId)) {
		ctx.logger.error("Invalid interview ID for indexing");
		return;
	}

	const interviewIds = await getInterviewIndex(ctx);

	// Only add if not already present
	if (!interviewIds.includes(interviewId)) {
		interviewIds.push(interviewId);
		await ctx.kv.set(INTERVIEWS_INDEX_STORE, INTERVIEWS_INDEX_KEY, {
			interviewIds,
		});
		ctx.logger.debug("Added interview to index: %s", interviewId);
	}
}

/**
 * Get an interview by ID
 */
export async function getInterview(
	ctx: AgentContext,
	id: string,
): Promise<ExploratoryCustomerInterview | null> {
	if (!isValidId(id)) {
		ctx.logger.error("Invalid interview ID provided");
		return null;
	}

	try {
		const result = await ctx.kv.get(INTERVIEWS_STORE, id);

		// Handle type conversion properly
		const interviewData = result?.data?.json() as unknown;
		const interview = interviewData as ExploratoryCustomerInterview | undefined;

		if (!interview) {
			ctx.logger.debug("No interview found with ID: %s", id);
			return null;
		}

		return interview;
	} catch (error) {
		ctx.logger.error("Failed to get interview %s: %s", id, error);
		return null;
	}
}

/**
 * Save an interview
 */
export async function saveInterview(
	ctx: AgentContext,
	interview: ExploratoryCustomerInterview,
): Promise<boolean> {
	if (!interview || !isValidId(interview.id)) {
		ctx.logger.error("Invalid interview provided for saving");
		return false;
	}

	try {
		// Convert to JSON-compatible format to ensure compatibility with KV store
		const interviewJson = JSON.parse(JSON.stringify(interview));

		// Save interview to KV store
		await ctx.kv.set(INTERVIEWS_STORE, interview.id, interviewJson);

		// Update index
		await updateInterviewIndex(ctx, interview.id);

		ctx.logger.debug("Interview saved: %s", interview.id);
		return true;
	} catch (error) {
		ctx.logger.error("Failed to save interview %s: %s", interview.id, error);
		return false;
	}
}

/**
 * List all interviews
 */
export async function listInterviews(ctx: AgentContext): Promise<ExploratoryCustomerInterview[]> {
	try {
		const interviewIds = await getInterviewIndex(ctx);

		if (interviewIds.length === 0) {
			return [];
		}

		// Fetch all interviews in parallel
		const interviewPromises = interviewIds.map((id) => getInterview(ctx, id));
		const interviews = await Promise.all(interviewPromises);

		// Filter out null results
		return interviews.filter(
			(interview: ExploratoryCustomerInterview | null): interview is ExploratoryCustomerInterview => interview !== null,
		);
	} catch (error) {
		ctx.logger.error("Failed to list interviews: %s", error);
		return [];
	}
}

/**
 * Create a new interview
 */
export async function createInterview(
	ctx: AgentContext,
	metadata: ExploratoryCustomerInterview['metadata'],
): Promise<ExploratoryCustomerInterview> {
	const interviewId = `interview-${Date.now()}-${metadata.customerName.slice(0, 8)}-${Math.random().toString(36).substring(2, 15)}`;
	const now = new Date().toISOString();

	// Create the interview object
	const interview: ExploratoryCustomerInterview = {
		id: interviewId,
		metadata,
		marketInsights: undefined,
		painPoints: undefined,
		productNeedsAndDesires: undefined,
		topicsDiscussed: undefined,
		sections: undefined,
		insightsSummary: undefined,
		followUp: undefined,
		createdAt: now,
		updatedAt: now
	};

	ctx.logger.info("Creating interview for customer: %s", metadata.customerName);

	// Save the interview
	const saved = await saveInterview(ctx, interview);
	if (!saved) {
		throw new Error("Failed to save interview");
	}

	return interview;
}

export async function updateInterviewTranscript(
	ctx: AgentContext,
	interviewId: string,
	transcript: string,
): Promise<ExploratoryCustomerInterview | null> {
	const interview = await getInterview(ctx, interviewId);

	if (!interview) {
		ctx.logger.warn("Cannot update transcript: interview not found: %s", interviewId);
		return null;
	}

	interview.transcript = transcript;
	interview.updatedAt = new Date().toISOString();

	ctx.logger.info("Updating interview transcript: %s", interviewId);
	await saveInterview(ctx, interview);
	return await getInterview(ctx, interviewId);
}

export async function updateInterviewRecordingUrls(
	ctx: AgentContext,
	interviewId: string,
	recordingUrl: string | undefined,
	localRecordingUrl: string | undefined,
): Promise<ExploratoryCustomerInterview | null> {
	const interview = await getInterview(ctx, interviewId);

	if (!interview) {
		ctx.logger.warn("Cannot update recordingUrl: interview not found: %s", interviewId);
		return null;
	}

	interview.recordingUrl = recordingUrl ? recordingUrl : interview.recordingUrl;
	interview.localRecordingUrl = localRecordingUrl ? localRecordingUrl : interview.localRecordingUrl;
	interview.updatedAt = new Date().toISOString();

	ctx.logger.info("Updating interview recordingUrl: %s", interviewId);
	await saveInterview(ctx, interview);
	return await getInterview(ctx, interviewId);
}

/**
 * Update an interview's section
 */
export async function updateInterviewSections(
	ctx: AgentContext,
	interviewId: string,
	sections: InterviewSection[],
): Promise<ExploratoryCustomerInterview | null> {
	const interview = await getInterview(ctx, interviewId);

	if (!interview) {
		ctx.logger.warn("Cannot update section: interview not found: %s", interviewId);
		return null;
	}

	interview.sections = sections;
	interview.updatedAt = new Date().toISOString();

	ctx.logger.info("Updating interview sections: %s", interviewId);
	await saveInterview(ctx, interview);
	return await getInterview(ctx, interviewId);
}

export async function updateInterviewMarketInsights(
	ctx: AgentContext,
	interviewId: string,
	marketInsights: ExploratoryCustomerInterview['marketInsights'],
): Promise<ExploratoryCustomerInterview | null> {
	const interview = await getInterview(ctx, interviewId);

	if (!interview) {
		ctx.logger.warn("Cannot update market insights: interview not found: %s", interviewId);
		return null;
	}

	interview.marketInsights = marketInsights;
	interview.updatedAt = new Date().toISOString();

	ctx.logger.info("Updating interview market insights: %s", interviewId);
	await saveInterview(ctx, interview);
	return await getInterview(ctx, interviewId);
}

export async function updateInterviewPainPoints(
	ctx: AgentContext,
	interviewId: string,
	painPoints: ExploratoryCustomerInterview['painPoints'],
): Promise<ExploratoryCustomerInterview | null> {
	const interview = await getInterview(ctx, interviewId);

	if (!interview) {
		ctx.logger.warn("Cannot update pain points: interview not found: %s", interviewId);
		return null;
	}

	interview.painPoints = painPoints;
	interview.updatedAt = new Date().toISOString();

	ctx.logger.info("Updating interview pain points: %s", interviewId);
	await saveInterview(ctx, interview);
	return await getInterview(ctx, interviewId);
}	
