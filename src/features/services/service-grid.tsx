import { SERVICES, type Service } from './registry';
import { ServiceCard } from './service-card';

/**
 * The list of services, wherever it appears. One service should read as a panel rather than a
 * card with a hole beside it, so the columns follow how many there actually are.
 */
export function ServiceGrid({ hrefFor }: { hrefFor: (service: Service) => string }) {
  return (
    <div className={`grid gap-3 ${SERVICES.length > 1 ? 'sm:grid-cols-2' : ''}`}>
      {SERVICES.map((service) => (
        <ServiceCard key={service.id} service={service} href={hrefFor(service)} />
      ))}
    </div>
  );
}
