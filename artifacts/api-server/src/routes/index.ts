import { Router, type IRouter } from "express";
import healthRouter from "./health";
import categoriesRouter from "./categories";
import schemesRouter from "./schemes";
import pibEntriesRouter from "./pib_entries";
import cagAuditsRouter from "./cag_audits";
import statsRouter from "./stats";
import refreshRouter from "./refresh";
import sessionRouter from "./session";
import reportIssueRouter from "./report_issue";
import adminIssuesRouter from "./admin_issues";
import newsRouter from "./news";
import representativesRouter from "./representatives";
import reviewQueueRouter from "./review_queue";
import officialResponsesRouter from "./official_responses";

const router: IRouter = Router();

router.use(healthRouter);
router.use(sessionRouter);
router.use(categoriesRouter);
router.use(schemesRouter);
router.use(pibEntriesRouter);
router.use(cagAuditsRouter);
router.use(statsRouter);
router.use(refreshRouter);
router.use(reportIssueRouter);
router.use(adminIssuesRouter);
router.use(newsRouter);

// Ported from jan-score (docs/jan-score-ideas.md) — representative-level
// civic accountability, as its own domain alongside this repo's existing
// scheme/state tracking.
router.use(representativesRouter);
router.use(reviewQueueRouter);
router.use(officialResponsesRouter);

export default router;
