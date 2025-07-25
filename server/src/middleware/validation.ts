import type { Request, Response, NextFunction } from "express";
import { validationResult } from "express-validator";

//Esta funcion del middleware se encarga de manejar los errores que se generan al enviar una request
export const handleInputErrors = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  //Valida si hay errores en la request que se envia
  const errors = validationResult(req);
  //Si hay errores, se envia un mensaje de error
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};
