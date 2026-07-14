import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.44.2";
import {
  generateRegistrationOptions as generateRegOptions,
  verifyRegistrationResponse as verifyRegResponse,
  generateAuthenticationOptions as generateAuthOptions,
  verifyAuthenticationResponse as verifyAuthResponse,
} from "npm:@simplewebauthn/server@13.3.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const textEncoder = new TextEncoder();

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

function stringToBytes(value: string): Uint8Array {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - normalized.length % 4) % 4);
  const rawData = atob(normalized + padding);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }

  return outputArray;
}

function expectedOrigins(rpID: string): string[] {
  const origins = [`https://${rpID}`];

  if (rpID === "localhost" || rpID === "127.0.0.1") {
    origins.push("http://localhost:3000", "http://localhost:5173", "http://localhost:8080");
  }

  return origins;
}

async function replaceChallenge(
  supabaseAdmin: ReturnType<typeof createClient>,
  employeeId: string,
  deviceFingerprint: string,
  challenge: string,
) {
  await supabaseAdmin
    .from("webauthn_challenges")
    .delete()
    .eq("employee_id", employeeId)
    .eq("device_fingerprint", deviceFingerprint);

  const { error } = await supabaseAdmin
    .from("webauthn_challenges")
    .insert({
      employee_id: employeeId,
      device_fingerprint: deviceFingerprint,
      challenge,
    });

  if (error) throw error;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseKey);

    const { action, payload } = await req.json();

    if (action === "generate-registration-options") {
      const { userId, deviceFingerprint, rpID, username } = payload;
      
      const { data: existing } = await supabaseAdmin
        .from("device_passkeys")
        .select("id")
        .eq("employee_id", userId)
        .eq("device_fingerprint", deviceFingerprint)
        .maybeSingle();

      if (existing) {
        throw new Error("Device already has a registered passkey.");
      }

      const rpName = "ASLENIX HRMS";
      
      const options = await generateRegOptions({
        rpName,
        rpID,
        userID: textEncoder.encode(userId),
        userName: username,
        userDisplayName: username,
        timeout: 60000,
        attestationType: "none",
        authenticatorSelection: {
          residentKey: "preferred",
          userVerification: "preferred",
        },
        preferredAuthenticatorType: "localDevice",
      });

      await replaceChallenge(supabaseAdmin, userId, deviceFingerprint, options.challenge);
      
      return new Response(JSON.stringify({ options }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "verify-registration-response") {
      const { userId, deviceFingerprint, rpID, response } = payload;

      const { data: challengeRow } = await supabaseAdmin
        .from("webauthn_challenges")
        .select("challenge")
        .eq("employee_id", userId)
        .eq("device_fingerprint", deviceFingerprint)
        .maybeSingle();

      if (!challengeRow) throw new Error("Challenge not found");

      const verification = await verifyRegResponse({
        response,
        expectedChallenge: challengeRow.challenge,
        expectedOrigin: expectedOrigins(rpID),
        expectedRPID: rpID,
        requireUserVerification: false,
      });

      if (verification.verified && verification.registrationInfo) {
        const { credential } = verification.registrationInfo;

        await supabaseAdmin.from("device_passkeys").insert({
          employee_id: userId,
          device_fingerprint: deviceFingerprint,
          credential_id: credential.id,
          public_key: bytesToBase64(credential.publicKey),
          counter: credential.counter,
          transports: credential.transports || [],
        });

        await supabaseAdmin.from("webauthn_challenges")
          .delete()
          .eq("employee_id", userId)
          .eq("device_fingerprint", deviceFingerprint);

        return new Response(JSON.stringify({ verified: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ verified: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "generate-authentication-options") {
      const { userId, deviceFingerprint, rpID } = payload;

      const { data: passkey } = await supabaseAdmin
        .from("device_passkeys")
        .select("*")
        .eq("employee_id", userId)
        .eq("device_fingerprint", deviceFingerprint)
        .maybeSingle();

      if (!passkey) throw new Error("No passkey found for this device.");

      const options = await generateAuthOptions({
        rpID,
        timeout: 60000,
        allowCredentials: [{
          id: passkey.credential_id,
          transports: passkey.transports || undefined,
        }],
        userVerification: "preferred",
      });

      await replaceChallenge(supabaseAdmin, userId, deviceFingerprint, options.challenge);

      return new Response(JSON.stringify({ options }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "verify-authentication-response") {
      const { userId, deviceFingerprint, rpID, response } = payload;

      const { data: challengeRow } = await supabaseAdmin
        .from("webauthn_challenges")
        .select("challenge")
        .eq("employee_id", userId)
        .eq("device_fingerprint", deviceFingerprint)
        .maybeSingle();

      if (!challengeRow) throw new Error("Challenge not found");

      const { data: passkey } = await supabaseAdmin
        .from("device_passkeys")
        .select("*")
        .eq("employee_id", userId)
        .eq("device_fingerprint", deviceFingerprint)
        .maybeSingle();

      if (!passkey) throw new Error("Passkey not found");

      const credential = {
        id: passkey.credential_id,
        publicKey: stringToBytes(passkey.public_key),
        counter: Number(passkey.counter),
        transports: passkey.transports || undefined,
      };

      const verification = await verifyAuthResponse({
        response,
        expectedChallenge: challengeRow.challenge,
        expectedOrigin: expectedOrigins(rpID),
        expectedRPID: rpID,
        requireUserVerification: false,
        credential,
      });

      if (verification.verified && verification.authenticationInfo) {
        await supabaseAdmin
          .from("device_passkeys")
          .update({ counter: verification.authenticationInfo.newCounter })
          .eq("id", passkey.id);

        await supabaseAdmin.from("webauthn_challenges")
          .delete()
          .eq("employee_id", userId)
          .eq("device_fingerprint", deviceFingerprint);
          
        return new Response(JSON.stringify({ verified: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ verified: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), { status: 400, headers: corsHeaders });
  } catch (error: any) {
    console.error(error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
