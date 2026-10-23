import {
  Body,
  Container,
  Heading,
  Hr,
  Html,
  Section,
  Text,
} from "@react-email/components";

interface ContactEmailProps {
  name: string;
  email: string;
  message: string;
}

/** Themed email sent via Resend when the contact form is submitted. */
export function ContactEmail({ name, email, message }: ContactEmailProps) {
  return (
    <Html lang="pt-BR">
      <Body
        style={{
          backgroundColor: "#0A0A0C",
          color: "#F2F4F8",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
          padding: "24px",
        }}
      >
        <Container
          style={{
            maxWidth: "560px",
            border: "1px solid #26262C",
            borderRadius: "12px",
            backgroundColor: "#121215",
            padding: "28px",
          }}
        >
          <Text
            style={{
              fontFamily: "monospace",
              color: "#C8CBD4",
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              fontSize: "12px",
              margin: 0,
            }}
          >
            {"// novo contato"}
          </Text>
          <Heading style={{ color: "#F2F4F8", fontSize: "22px" }}>
            {name}
          </Heading>
          <Text style={{ color: "#9198A5", marginTop: "-8px" }}>{email}</Text>
          <Hr style={{ borderColor: "#26262C" }} />
          <Section>
            <Text
              style={{
                color: "#F2F4F8",
                lineHeight: 1.7,
                whiteSpace: "pre-wrap",
              }}
            >
              {message}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
