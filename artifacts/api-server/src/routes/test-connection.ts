import { Router, type IRouter } from "express";

const router: IRouter = Router();

router.post("/businesses/test-connection", async (req, res): Promise<void> => {
  const { whatsappPhoneNumberId, whatsappAccessToken } = req.body;

  if (!whatsappPhoneNumberId || !whatsappAccessToken) {
    res.status(400).json({ error: "Phone number ID and access token are required." });
    return;
  }

  try {
    const response = await fetch(
      `https://graph.facebook.com/v19.0/${whatsappPhoneNumberId}?fields=display_phone_number,verified_name,quality_rating,status`,
      {
        headers: {
          Authorization: `Bearer ${whatsappAccessToken}`,
        },
      }
    );

    const data = await response.json() as Record<string, unknown>;

    if (!response.ok) {
      const errorMsg =
        (data?.error as { message?: string } | undefined)?.message ?? "Invalid credentials";
      req.log.warn({ phoneNumberId: whatsappPhoneNumberId, status: response.status }, "Meta credential check failed");
      res.status(400).json({ error: errorMsg });
      return;
    }

    req.log.info({ phoneNumberId: whatsappPhoneNumberId }, "Meta credentials verified");
    res.json({
      valid: true,
      displayPhoneNumber: data.display_phone_number,
      verifiedName: data.verified_name,
      qualityRating: data.quality_rating,
      status: data.status,
    });
  } catch (err) {
    req.log.error({ err }, "Error contacting Meta API");
    res.status(502).json({ error: "Could not reach Meta API. Check your connection." });
  }
});

export default router;
