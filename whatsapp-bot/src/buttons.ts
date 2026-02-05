import twilio from 'twilio';

const MessagingResponse = twilio.twiml.MessagingResponse;

export interface Button {
  id: string;
  title: string;
}

export interface ListItem {
  id: string;
  title: string;
  description?: string;
}

export interface ListSection {
  title?: string;
  items: ListItem[];
}

// Send message with reply buttons (max 3)
export function createButtonMessage(body: string, buttons: Button[]): string {
  if (buttons.length > 3) {
    throw new Error('WhatsApp supports max 3 reply buttons');
  }

  const twiml = new MessagingResponse();
  const message = twiml.message();
  message.body(body);

  buttons.forEach(btn => {
    message.media(`button:${btn.id}:${btn.title}`);
  });

  return twiml.toString();
}

// Send message with list (max 10 items)
export function createListMessage(
  body: string,
  buttonText: string,
  sections: ListSection[]
): string {
  const totalItems = sections.reduce((sum, section) => sum + section.items.length, 0);
  
  if (totalItems > 10) {
    throw new Error('WhatsApp supports max 10 list items');
  }

  const twiml = new MessagingResponse();
  const message = twiml.message();
  message.body(body);

  sections.forEach(section => {
    section.items.forEach(item => {
      const itemText = item.description 
        ? `${item.title}\n${item.description}`
        : item.title;
      message.media(`list:${item.id}:${itemText}`);
    });
  });

  return twiml.toString();
}

// Format text with WhatsApp markdown
export function formatWhatsAppText(text: string): string {
  // WhatsApp supports: *bold*, _italic_, ~strikethrough~, ```code```
  return text;
}

// Create quick reply buttons (max 13)
export function createQuickReply(body: string, replies: string[]): string {
  if (replies.length > 13) {
    throw new Error('WhatsApp supports max 13 quick replies');
  }

  const twiml = new MessagingResponse();
  const message = twiml.message();
  message.body(body);

  replies.forEach(reply => {
    message.media(`reply:${reply}`);
  });

  return twiml.toString();
}
