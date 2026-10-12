// Gemini Live function declarations for the voice concierge.
// Handlers live in server.mjs; each declaration here matches one branch there.

const DATE_HINT = 'Reservation date as YYYY-MM-DD. Convert "tonight" or "tomorrow" using the current date in the system prompt.';
const TIME_HINT = 'Time in 24-hour HH:MM format, for example 19:30 for 7:30 PM.';

export function voiceToolDeclarations() {
  return [
    {
      name: 'check_availability',
      description: 'Checks whether a table is free for a party size, date and time at this restaurant. Call before confirming any new booking.',
      parameters: {
        type: 'object',
        properties: {
          party_size: { type: 'integer', description: 'Number of guests' },
          target_time: { type: 'string', description: TIME_HINT },
          date: { type: 'string', description: DATE_HINT },
        },
        required: ['party_size', 'target_time'],
      },
    },
    {
      name: 'submit_reservation_data',
      description: 'Creates a confirmed reservation in the restaurant database. Only call after the caller has confirmed every detail. Returns a confirmation code only when the booking is saved.',
      parameters: {
        type: 'object',
        properties: {
          customer_name: { type: 'string', description: "The guest's full name" },
          customer_phone: { type: 'string', description: 'Phone number for the booking, digits with optional country code' },
          party_size: { type: 'integer', description: 'Number of guests' },
          confirmed_time: { type: 'string', description: TIME_HINT },
          date: { type: 'string', description: DATE_HINT },
          special_requests: { type: 'string', description: 'Accessibility, seating or celebration requests. Optional.' },
        },
        required: ['customer_name', 'customer_phone', 'party_size', 'confirmed_time', 'date'],
      },
    },
    {
      name: 'find_reservation',
      description: 'Looks up an existing reservation. Use the confirmation code with the phone number, or the phone number with the guest name.',
      parameters: {
        type: 'object',
        properties: {
          confirmation_code: { type: 'string', description: 'Six-character confirmation code' },
          customer_phone: { type: 'string', description: 'Phone number the booking was made under' },
          customer_name: { type: 'string', description: 'Guest name on the booking' },
        },
        required: ['customer_phone'],
      },
    },
    {
      name: 'modify_reservation',
      description: 'Changes party size, date, time or special requests on an existing reservation. Only call after the caller confirms the change. Requires the confirmation code and the phone number on the booking.',
      parameters: {
        type: 'object',
        properties: {
          confirmation_code: { type: 'string', description: 'Six-character confirmation code' },
          customer_phone: { type: 'string', description: 'Phone number the booking was made under' },
          new_party_size: { type: 'integer', description: 'New number of guests, if changing' },
          new_date: { type: 'string', description: `New date, if changing. ${DATE_HINT}` },
          new_time: { type: 'string', description: `New time, if changing. ${TIME_HINT}` },
          special_requests: { type: 'string', description: 'Replacement special requests, if changing' },
        },
        required: ['confirmation_code', 'customer_phone'],
      },
    },
    {
      name: 'cancel_reservation',
      description: 'Cancels an existing reservation. Only call after the caller confirms the cancellation. Requires the confirmation code and the phone number on the booking.',
      parameters: {
        type: 'object',
        properties: {
          confirmation_code: { type: 'string', description: 'Six-character confirmation code' },
          customer_phone: { type: 'string', description: 'Phone number the booking was made under' },
        },
        required: ['confirmation_code', 'customer_phone'],
      },
    },
    {
      name: 'request_staff_callback',
      description: 'Records a request for a team member to call back. Use when the caller asks for a person, has a complaint, a supplier or business inquiry, or asks something the prompt does not cover. This does not transfer the call.',
      parameters: {
        type: 'object',
        properties: {
          customer_name: { type: 'string', description: "The caller's name, if given" },
          customer_phone: { type: 'string', description: 'Best callback number, if given' },
          reason: { type: 'string', description: 'Short summary of why a callback is needed' },
        },
        required: ['reason'],
      },
    },
    {
      name: 'submit_food_order',
      description: 'Submits a takeout or pickup food order to the kitchen. Payment is not taken over the phone.',
      parameters: {
        type: 'object',
        properties: {
          customer_name: { type: 'string', description: 'The caller or guest name' },
          customer_phone: { type: 'string', description: 'Customer contact phone' },
          timing: { type: 'string', description: "Pickup timing: 'ASAP' or a scheduled time such as 19:45" },
          items: {
            type: 'array',
            description: 'Items ordered from the menu',
            items: {
              type: 'object',
              properties: {
                item_name: { type: 'string' },
                quantity: { type: 'integer' },
              },
              required: ['item_name'],
            },
          },
        },
        required: ['customer_name', 'customer_phone', 'timing', 'items'],
      },
    },
  ];
}
