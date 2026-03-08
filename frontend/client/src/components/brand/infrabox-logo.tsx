type InfraboxLogoProps = {
  className?: string;
};

export function InfraboxLogo({ className = "" }: InfraboxLogoProps) {
  return (
    <img
      src="/infrabox-logo.png"
      alt="Infrabox logo"
      className={className}
      loading="eager"
      decoding="async"
    />
  );
}
