export function friendlyWhatsAppError(message: string): string {
  if (message.includes("131030")) {
    return "Recipient phone number is not in the allowed list. In test mode only numbers added to 'Phone numbers you can message' in the Meta dashboard can receive messages, or move the WhatsApp Business Account to production mode.";
  }
  if (message.includes("132000")) {
    return "Template parameter count mismatch. Check that the variable mapping matches the number of placeholders in the template.";
  }
  if (message.includes("131005")) {
    return "Customer has not opted in. They must send a message to your WhatsApp Business number first.";
  }
  if (message.includes("132001")) {
    return "Template not found for the selected language or not approved yet. Check the language code and that the template is approved.";
  }
  if (message.includes("131048")) {
    return "Message failed: more than 24 hours have passed since the customer last messaged your business. Ask them to message your WhatsApp number to reopen the conversation window.";
  }
  if (message.includes("63032")) {
    return "WhatsApp is preventing delivery to this number (recipient is part of a WhatsApp experiment). Contact the customer by other means.";
  }
  return message;
}
