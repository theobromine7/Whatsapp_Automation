import { Router, type IRouter } from "express";
import healthRouter from "./health";
import businessesRouter from "./businesses";
import conversationsRouter from "./conversations";
import whatsappRouter from "./whatsapp";
import statsRouter from "./stats";
import testConnectionRouter from "./test-connection";
import sessionsRouter from "./sessions";
import knowledgeRouter from "./knowledge";
import broadcastsRouter from "./broadcasts";

const router: IRouter = Router();

router.use(healthRouter);
router.use(businessesRouter);
router.use(conversationsRouter);
router.use(whatsappRouter);
router.use(statsRouter);
router.use(testConnectionRouter);
router.use(sessionsRouter);
router.use(knowledgeRouter);
router.use(broadcastsRouter);

export default router;
