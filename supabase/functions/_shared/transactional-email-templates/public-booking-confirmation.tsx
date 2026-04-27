import * as React from 'npm:react@18.3.1'
import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'Evenimente CNCV'

interface PublicBookingConfirmationProps {
  guestName?: string
  eventTitle?: string
  eventDate?: string
  eventTime?: string
  eventLocation?: string
  ticketCount?: number
  reservationCode?: string
  manageUrl?: string
}

const PublicBookingConfirmationEmail = ({
  guestName = '',
  eventTitle = '',
  eventDate = '',
  eventTime = '',
  eventLocation = '',
  ticketCount = 1,
  reservationCode = '',
  manageUrl = '#',
}: PublicBookingConfirmationProps) => (
  <Html lang="ro" dir="ltr">
    <Head />
    <Preview>Rezervarea ta la {eventTitle} este confirmată</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Rezervare confirmată!</Heading>
        <Text style={text}>
          {guestName ? `Bună, ${guestName}!` : 'Bună!'} Îți confirmăm că rezervarea ta la
          evenimentul de mai jos a fost înregistrată.
        </Text>

        <Section style={card}>
          <Heading as="h2" style={h2}>{eventTitle}</Heading>
          {eventDate && <Text style={detail}><strong>Data:</strong> {eventDate}</Text>}
          {eventTime && <Text style={detail}><strong>Ora:</strong> {eventTime}</Text>}
          {eventLocation && <Text style={detail}><strong>Locația:</strong> {eventLocation}</Text>}
          <Text style={detail}>
            <strong>Bilete rezervate:</strong> {ticketCount}
          </Text>
          {reservationCode && (
            <Text style={detail}>
              <strong>Cod rezervare:</strong>{' '}
              <span style={code}>{reservationCode}</span>
            </Text>
          )}
        </Section>

        <Text style={text}>
          Folosește butonul de mai jos pentru a vedea biletele cu codurile QR, a le
          printa sau a anula rezervarea dacă nu mai poți participa.
        </Text>

        <Section style={{ textAlign: 'center', margin: '28px 0' }}>
          <Button href={manageUrl} style={button}>
            Vezi sau anulează biletele
          </Button>
        </Section>

        <Text style={smallText}>
          Dacă butonul nu funcționează, copiază acest link în browser:
          <br />
          <span style={linkText}>{manageUrl}</span>
        </Text>

        <Hr style={hr} />
        <Text style={footer}>
          Te rugăm să anulezi rezervarea dacă nu mai poți ajunge, pentru ca alți
          participanți să poată ocupa locul. Mulțumim!
          <br />
          <br />
          Cu drag,
          <br />
          Echipa {SITE_NAME}
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: PublicBookingConfirmationEmail,
  subject: (data: Record<string, any>) =>
    `Rezervare confirmată: ${data.eventTitle ?? 'eveniment'}`,
  displayName: 'Confirmare rezervare publică',
  previewData: {
    guestName: 'Maria Popescu',
    eventTitle: 'Concert de Crăciun',
    eventDate: '20.12.2026',
    eventTime: '18:00 – 20:00',
    eventLocation: 'Sala Festivă CNCV',
    ticketCount: 2,
    reservationCode: 'abc123-demo-code',
    manageUrl: 'https://evenimentecncv.online/public/tickets/abc123-demo-code',
  },
} satisfies TemplateEntry

const main = {
  backgroundColor: '#ffffff',
  fontFamily:
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, sans-serif',
}
const container = { padding: '24px 32px', maxWidth: '560px' }
const h1 = {
  fontSize: '24px',
  fontWeight: 'bold',
  color: '#0f172a',
  margin: '0 0 16px',
}
const h2 = {
  fontSize: '18px',
  fontWeight: 'bold',
  color: '#0f172a',
  margin: '0 0 12px',
}
const text = {
  fontSize: '15px',
  color: '#334155',
  lineHeight: '1.6',
  margin: '0 0 16px',
}
const smallText = {
  fontSize: '12px',
  color: '#64748b',
  lineHeight: '1.5',
  margin: '12px 0 0',
}
const linkText = {
  color: '#2563eb',
  wordBreak: 'break-all' as const,
}
const detail = {
  fontSize: '14px',
  color: '#334155',
  lineHeight: '1.6',
  margin: '4px 0',
}
const card = {
  backgroundColor: '#f8fafc',
  border: '1px solid #e2e8f0',
  borderRadius: '8px',
  padding: '16px 20px',
  margin: '20px 0',
}
const code = {
  fontFamily: 'monospace',
  backgroundColor: '#e2e8f0',
  padding: '2px 6px',
  borderRadius: '4px',
  fontSize: '13px',
}
const button = {
  backgroundColor: '#2563eb',
  color: '#ffffff',
  padding: '12px 24px',
  borderRadius: '6px',
  textDecoration: 'none',
  fontSize: '15px',
  fontWeight: 'bold',
  display: 'inline-block',
}
const hr = { borderColor: '#e2e8f0', margin: '28px 0 16px' }
const footer = {
  fontSize: '13px',
  color: '#64748b',
  lineHeight: '1.5',
  margin: '0',
}
