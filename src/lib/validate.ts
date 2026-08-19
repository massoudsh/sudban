import { NextFunction, Request, Response } from "express";
import { ZodSchema } from "zod";

type Source = "body" | "query" | "params";

/**
 * میان‌افزار اعتبارسنجی ساخت‌یافته بر پایه zod. در صورت خطا، پاسخ ۴۰۰ یکسان با جزئیات
 * فارسی/ساختاریافته برمی‌گرداند. در صورت موفقیت، مقدار parse/coerce شده جایگزین req[source] می‌شود.
 */
export function validate(schema: ZodSchema, source: Source = "body") {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      res.status(400).json({
        error: "ورودی نامعتبر است",
        details: result.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      });
      return;
    }

    if (source === "query") {
      // req.query در اکسپرس ۴ فقط getter نیست، اما برای اطمینان مقادیر را جایگزین می‌کنیم
      Object.assign(req.query, result.data);
    } else {
      (req as unknown as Record<Source, unknown>)[source] = result.data;
    }
    next();
  };
}
